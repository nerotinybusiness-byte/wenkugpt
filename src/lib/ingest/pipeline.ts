// Load environment variables immediately for CLI/script support
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { parseDocument, ParsedDocument } from './parser';
import { chunkDocument, SemanticChunk, DEFAULT_CHUNKER_CONFIG } from './chunker';
import { embedTexts, isEmbedderConfigured, DEFAULT_EMBEDDER_CONFIG } from './embedder';
import { detectTemplateForDocument, type TemplateDiagnostics } from './template';
import { runOcrRescueProvider, resolveOcrEngine } from './ocr-provider';
import type { OcrEngine } from './ocr';
import {
    mergeOcrTextIntoPages,
    resolveOcrCandidatePages,
    shouldTriggerOcrRescue,
} from './ocr-rescue';
import { logResidencyStatus } from '@/lib/config/regions';
import CryptoJS from 'crypto-js';
import fs from 'fs/promises';
import { db } from '@/lib/db';
import { documents, chunks as chunksTable, type BoundingBox } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { devLog, logError, logInfo } from '@/lib/logger';
import { getRagV2Flags } from '@/lib/rag-v2/flags';
import { ingestSlangCandidates } from '@/lib/rag-v2/ingest';

/**
 * Pipeline processing result
 */
export interface PipelineResult {
    /** Created document ID */
    documentId: string;
    /** Parsed document information */
    document: ParsedDocument;
    /** Semantic chunks with embeddings */
    chunks: SemanticChunk[];
    /** Template diagnostics used for filtering and warnings */
    template: TemplateDiagnostics;
    /** OCR rescue diagnostics for empty/low chunk PDF ingests */
    ocrRescue: OcrRescueDiagnostics;
    /** Processing statistics */
    stats: {
        parseTimeMs: number;
        chunkTimeMs: number;
        embedTimeMs: number;
        storeTimeMs: number;
        totalTimeMs: number;
        pageCount: number;
        chunkCount: number;
        totalTextBlocks: number;
        totalTokens: number;
        embeddingApiCalls: number;
        slangCandidates: number;
        indexableChunkCount: number;
        boilerplateChunkCount: number;
    };
}

export interface OcrRescueDiagnostics {
    enabled: boolean;
    attempted: boolean;
    applied: boolean;
    engine: OcrEngine | null;
    fallbackEngine: OcrEngine | null;
    engineUsed: OcrEngine | null;
    chunksBefore: number;
    chunksAfter: number;
    pagesAttempted: number;
    warnings: string[];
}

/**
 * Generate SHA-256 hash of content
 */
function sha256(content: string | Buffer | Uint8Array): string {
    const data = typeof content === 'string'
        ? content
        : Buffer.from(content).toString('base64');
    return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
}

function normalizeDisplayFilename(filename: string): string {
    const basename = filename.split(/[/\\]/).pop() || filename;
    // Stored files are typically "<userId>_<uuid>_<safeOriginalName>".
    return basename.replace(/^[^_]+_[0-9a-fA-F-]{36}_/, '');
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function sanitizeBoundingBox(bbox: BoundingBox | null | undefined): BoundingBox | null {
    if (!bbox) return null;
    const values = [bbox.x, bbox.y, bbox.width, bbox.height];
    if (values.some((value) => !Number.isFinite(value))) return null;

    const x = clamp01(bbox.x);
    const y = clamp01(bbox.y);
    const width = clamp01(Math.min(bbox.width, 1 - x));
    const height = clamp01(Math.min(bbox.height, 1 - y));
    if (width <= 0 || height <= 0) return null;

    return { x, y, width, height };
}

function mergeNearbyHighlightBoxes(boxes: BoundingBox[]): BoundingBox[] {
    if (boxes.length <= 1) return boxes;

    const sorted = [...boxes].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const merged: BoundingBox[] = [];

    for (const box of sorted) {
        const last = merged[merged.length - 1];
        if (!last) {
            merged.push({ ...box });
            continue;
        }

        const sameRow = Math.abs(last.y - box.y) < 0.02 && Math.abs(last.height - box.height) < 0.03;
        const touching = box.x <= last.x + last.width + 0.03;
        if (sameRow && touching) {
            const minX = Math.min(last.x, box.x);
            const maxX = Math.max(last.x + last.width, box.x + box.width);
            const minY = Math.min(last.y, box.y);
            const maxY = Math.max(last.y + last.height, box.y + box.height);
            last.x = minX;
            last.y = minY;
            last.width = maxX - minX;
            last.height = maxY - minY;
            continue;
        }

        merged.push({ ...box });
    }

    return merged;
}

function buildHighlightBoxes(chunk: SemanticChunk): BoundingBox[] | null {
    const chunkBox = sanitizeBoundingBox(chunk.bbox);
    const sourceBlocks = (chunk as SemanticChunk & { sourceBlocks?: Array<{ bbox: BoundingBox }> }).sourceBlocks;
    if (!Array.isArray(sourceBlocks) || sourceBlocks.length === 0) {
        return chunkBox ? [chunkBox] : null;
    }

    const dedup = new Map<string, BoundingBox>();
    for (const block of sourceBlocks) {
        const bbox = sanitizeBoundingBox(block?.bbox);
        if (!bbox) continue;
        const key = [
            bbox.x.toFixed(4),
            bbox.y.toFixed(4),
            bbox.width.toFixed(4),
            bbox.height.toFixed(4),
        ].join(':');
        if (!dedup.has(key)) dedup.set(key, bbox);
    }

    const boxes = mergeNearbyHighlightBoxes([...dedup.values()]
        .sort((a, b) => (a.y - b.y) || (a.x - b.x))
        .slice(0, 48))
        .slice(0, 24);

    if (boxes.length === 0) {
        return chunkBox ? [chunkBox] : null;
    }

    return boxes;
}

function buildHighlightText(chunk: SemanticChunk): string | null {
    const sourceBlocks = (chunk as SemanticChunk & {
        sourceBlocks?: Array<{ bbox?: BoundingBox; text?: string }>;
    }).sourceBlocks;
    if (!Array.isArray(sourceBlocks) || sourceBlocks.length === 0) {
        return null;
    }

    const snippet = sourceBlocks
        .filter((block) => typeof block?.text === 'string')
        .sort((a, b) => {
            const ay = a.bbox?.y ?? 0;
            const by = b.bbox?.y ?? 0;
            if (ay !== by) return ay - by;
            const ax = a.bbox?.x ?? 0;
            const bx = b.bbox?.x ?? 0;
            return ax - bx;
        })
        .map((block) => (block.text || '').replace(/\s+/g, ' ').trim())
        .filter((text) => text.length > 0)
        .slice(0, 6)
        .join(' ')
        .trim()
        .slice(0, 480);

    return snippet || null;
}


/**
 * Process a document through the full ingestion pipeline
 *
 * @param buffer - File content as Buffer or Uint8Array
 * @param mimeType - MIME type of the file
 * @param filename - Original filename
 * @param options - Optional configuration
 * @returns Pipeline result with document ID and stats
 */
export async function processPipeline(
    buffer: Buffer | Uint8Array,
    mimeType: string,
    filename: string,
    options: {
        userId?: string;
        accessLevel?: 'public' | 'private' | 'team';
        skipEmbedding?: boolean;
        skipStorage?: boolean;
        originalFilename?: string;
        templateProfileId?: string;
        emptyChunkOcrEnabled?: boolean;
        emptyChunkOcrEngine?: OcrEngine;
    } = {},
): Promise<PipelineResult> {
    const startTime = performance.now();
    const userId = options.userId;
    const accessLevel = options.accessLevel || 'private';

    if (!options.skipStorage && !userId) {
        throw new Error('userId is required when skipStorage is false.');
    }

    devLog(`\n${'='.repeat(60)}`);
    devLog('WENKUGPT Ingestion Pipeline');
    devLog(`${'='.repeat(60)}`);
    devLog(`File: ${filename}`);
    devLog(`Type: ${mimeType}`);
    devLog(`Size: ${(buffer.length / 1024).toFixed(2)} KB`);
    devLog(`Access: ${accessLevel}`);
    logResidencyStatus();
    devLog(`${'='.repeat(60)}\n`);

    // =========================================================================
    // STEP 1: Parse Document
    // =========================================================================
    devLog('Step 1: Parsing document...');
    const parseStart = performance.now();

    const document = await parseDocument(buffer, mimeType);

    const parseTimeMs = performance.now() - parseStart;
    devLog(`   Parsed ${document.pageCount} pages in ${parseTimeMs.toFixed(0)}ms`);

    const totalTextBlocks = document.pages.reduce(
        (sum, page) => sum + page.textBlocks.length,
        0,
    );
    devLog(`   Found ${totalTextBlocks} text blocks`);

    // =========================================================================
    // STEP 2: Semantic Chunking
    // =========================================================================
    devLog('\nStep 2: Semantic chunking...');
    const chunkStart = performance.now();

    let workingPages = document.pages;
    let chunks = chunkDocument(workingPages, DEFAULT_CHUNKER_CONFIG);
    const selectedOcrEngine = resolveOcrEngine(options.emptyChunkOcrEngine);
    const ocrRescue: OcrRescueDiagnostics = {
        enabled: options.emptyChunkOcrEnabled === true,
        attempted: false,
        applied: false,
        engine: options.emptyChunkOcrEnabled === true ? selectedOcrEngine : null,
        fallbackEngine: null,
        engineUsed: null,
        chunksBefore: chunks.length,
        chunksAfter: chunks.length,
        pagesAttempted: 0,
        warnings: [],
    };

    devLog(`   Initial chunks: ${chunks.length}`);

    const shouldEvaluateOcrRescue = shouldTriggerOcrRescue(mimeType, chunks.length);

    if (shouldEvaluateOcrRescue) {
        if (!ocrRescue.enabled) {
            ocrRescue.warnings.push('ocr_rescue_disabled');
        } else {
            const candidatePages = resolveOcrCandidatePages(workingPages);
            if (candidatePages.length === 0) {
                ocrRescue.warnings.push('ocr_rescue_no_text_extracted');
            } else {
                ocrRescue.attempted = true;
                const providerResult = await runOcrRescueProvider({
                    pdfBuffer: buffer,
                    pages: candidatePages,
                    engine: selectedOcrEngine,
                });
                ocrRescue.pagesAttempted = providerResult.pagesProcessed;
                ocrRescue.engineUsed = providerResult.engineUsed;
                ocrRescue.fallbackEngine = providerResult.fallbackEngine;
                if (providerResult.warnings.length > 0) {
                    ocrRescue.warnings.push(...providerResult.warnings);
                }

                const extractedCount = [...providerResult.ocrByPage.values()]
                    .map((text) => text.trim())
                    .filter((text) => text.length > 0)
                    .length;

                if (extractedCount === 0) {
                    if (!ocrRescue.warnings.includes('ocr_rescue_no_text_extracted')) {
                        ocrRescue.warnings.push('ocr_rescue_no_text_extracted');
                    }
                } else {
                    workingPages = mergeOcrTextIntoPages(workingPages, providerResult.ocrByPage);
                    const rescuedChunks = chunkDocument(workingPages, DEFAULT_CHUNKER_CONFIG);
                    ocrRescue.chunksAfter = rescuedChunks.length;
                    ocrRescue.applied = rescuedChunks.length > ocrRescue.chunksBefore;
                    if (ocrRescue.applied) {
                        chunks = rescuedChunks;
                    } else {
                        ocrRescue.warnings.push('ocr_rescue_no_chunk_gain');
                    }
                }

                logInfo('OCR rescue telemetry', {
                    route: 'ingest',
                    stage: 'ocr-rescue',
                    ingest_ocr_engine_usage: providerResult.engineUsed ?? providerResult.engine,
                    ingest_ocr_engine_fallback_rate: providerResult.fallbackEngine ? 1 : 0,
                    ingest_ocr_rescue_success_rate_by_engine: ocrRescue.applied ? 1 : 0,
                    ingest_ocr_latency_ms: Math.round(providerResult.latencyMs),
                    ingest_ocr_warning_codes: ocrRescue.warnings,
                });
            }
        }
    }

    ocrRescue.chunksAfter = chunks.length;
    const chunkTimeMs = performance.now() - chunkStart;
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

    devLog(`   Final chunks: ${chunks.length} in ${chunkTimeMs.toFixed(0)}ms`);
    if (ocrRescue.attempted) {
        devLog(`   OCR rescue attempted on ${ocrRescue.pagesAttempted} page(s), applied=${ocrRescue.applied}`);
    } else if (ocrRescue.warnings.length > 0) {
        devLog(`   OCR rescue warnings: ${ocrRescue.warnings.join(', ')}`);
    }
    devLog(`   Total tokens: ~${totalTokens}`);

    // =========================================================================
    // STEP 2.5: Template diagnostics and boilerplate classification
    // =========================================================================
    devLog('\nStep 2.5: Template diagnostics...');
    const templateResult = await detectTemplateForDocument({
        buffer,
        mimeType,
        document: {
            ...document,
            pages: workingPages,
        },
        chunks,
        templateProfileId: options.templateProfileId,
    });
    const boilerplateChunkIndexes = templateResult.boilerplateChunkIndexes;
    const indexedChunkEntries = chunks
        .map((chunk, index) => ({ chunk, index }))
        .filter((entry) => !boilerplateChunkIndexes.has(entry.index));

    devLog(`   Template matched: ${templateResult.diagnostics.matched ? 'yes' : 'no'}`);
    devLog(`   Boilerplate chunks filtered: ${boilerplateChunkIndexes.size}`);
    devLog(`   Indexable chunks: ${indexedChunkEntries.length}`);
    logInfo('Template ingest telemetry', {
        route: 'ingest',
        stage: 'template',
        template_match_rate: templateResult.diagnostics.matched ? 1 : 0,
        template_boilerplate_chunks_filtered: boilerplateChunkIndexes.size,
        ocr_fallback_rate: templateResult.diagnostics.detectionMode === 'ocr' || templateResult.diagnostics.detectionMode === 'hybrid' ? 1 : 0,
    });

    // =========================================================================
    // STEP 3: Generate Embeddings
    // =========================================================================
    devLog('\nStep 3: Generating embeddings...');
    const embedStart = performance.now();

    let embeddingApiCalls = 0;
    const embeddingByChunkIndex = new Map<number, number[]>();

    if (indexedChunkEntries.length === 0) {
        devLog('   Embedding skipped (no indexable chunks after template filtering)');
    } else if (options.skipEmbedding || !isEmbedderConfigured()) {
        devLog('   Embedding skipped (API key not configured or skipEmbedding=true)');
        for (const entry of indexedChunkEntries) {
            embeddingByChunkIndex.set(entry.index, new Array(768).fill(0));
        }
    } else {
        const embedResult = await embedTexts(
            indexedChunkEntries.map((entry) => entry.chunk.text),
            DEFAULT_EMBEDDER_CONFIG,
        );
        for (const embedding of embedResult.embeddings) {
            const mapped = indexedChunkEntries[embedding.index];
            if (!mapped) continue;
            embeddingByChunkIndex.set(mapped.index, embedding.embedding);
        }
        for (const entry of indexedChunkEntries) {
            if (!embeddingByChunkIndex.has(entry.index)) {
                embeddingByChunkIndex.set(entry.index, new Array(768).fill(0));
            }
        }
        embeddingApiCalls = embedResult.apiCalls;
        devLog(`   Generated ${embedResult.embeddings.length} embeddings in ${embedResult.processingTimeMs.toFixed(0)}ms`);
        devLog(`   API calls: ${embeddingApiCalls}`);
    }

    const embedTimeMs = performance.now() - embedStart;

    // =========================================================================
    // STEP 4: Store in Database
    // =========================================================================
    devLog('\nStep 4: Storing in database...');
    const storeStart = performance.now();

    let documentId = '';
    let slangCandidates = 0;

    if (options.skipStorage) {
        devLog('   Storage skipped (skipStorage=true)');
        documentId = 'skipped';
    } else {
        try {
            // Create document record inside a transaction to avoid partial ingest
            const fileHash = sha256(buffer);

            await db.transaction(async (tx) => {
                const existingDoc = await tx
                    .select({ id: documents.id })
                    .from(documents)
                    .where(and(eq(documents.userId, userId!), eq(documents.fileHash, fileHash)))
                    .limit(1);

                if (existingDoc.length > 0) {
                    documentId = existingDoc[0].id;
                    devLog(`   Duplicate file detected, reusing document: ${documentId}`);
                    return;
                }

                const [doc] = await tx.insert(documents).values({
                    userId: userId!,
                    filename,
                    originalFilename: options.originalFilename || normalizeDisplayFilename(filename),
                    fileHash,
                    mimeType,
                    fileSize: buffer.length,
                    pageCount: document.pageCount,
                    accessLevel,
                    processingStatus: 'processing',
                    templateProfileId: templateResult.diagnostics.profileId,
                    templateMatched: templateResult.diagnostics.matched,
                    templateMatchScore: templateResult.diagnostics.matchScore,
                    templateBoilerplateChunks: templateResult.diagnostics.boilerplateChunks,
                    templateDetectionMode: templateResult.diagnostics.detectionMode === 'none'
                        ? null
                        : templateResult.diagnostics.detectionMode,
                    templateWarnings: templateResult.diagnostics.warnings.length > 0
                        ? templateResult.diagnostics.warnings
                        : null,
                    ocrRescueApplied: ocrRescue.applied,
                    ocrRescueEngine: ocrRescue.engine,
                    ocrRescueFallbackEngine: ocrRescue.fallbackEngine,
                    ocrRescueChunksRecovered: Math.max(0, ocrRescue.chunksAfter - ocrRescue.chunksBefore),
                    ocrRescueWarnings: ocrRescue.warnings.length > 0
                        ? ocrRescue.warnings
                        : null,
                }).returning();

                documentId = doc.id;
                devLog(`   Created document: ${documentId}`);

                // Prepare chunk records.
                const chunkRecords = chunks.map((chunk, index) => {
                    const isTemplateBoilerplate = boilerplateChunkIndexes.has(index);
                    return {
                        documentId: doc.id,
                        content: chunk.text,
                        contentHash: sha256(chunk.text),
                        embedding: isTemplateBoilerplate
                            ? null
                            : (embeddingByChunkIndex.get(index) ?? new Array(768).fill(0)),
                        pageNumber: chunk.page,
                        boundingBox: chunk.bbox,
                        highlightBoxes: buildHighlightBoxes(chunk),
                        highlightText: buildHighlightText(chunk),
                        parentHeader: chunk.parentHeader || null,
                        chunkIndex: index,
                        tokenCount: chunk.tokenCount,
                        accessLevel,
                        isTemplateBoilerplate,
                        // Generate simple full-text search vector (Czech dict not available).
                        ftsVector: isTemplateBoilerplate
                            ? null
                            : sql`to_tsvector('simple', ${chunk.text})`,
                    };
                });

                // Batch insert chunks (100 at a time for Supabase).
                const BATCH_SIZE = 100;
                for (let i = 0; i < chunkRecords.length; i += BATCH_SIZE) {
                    const batch = chunkRecords.slice(i, i + BATCH_SIZE);
                    await tx.insert(chunksTable).values(batch);
                    devLog(`   Inserted chunk batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunkRecords.length / BATCH_SIZE)}`);
                }

                // Update document status to completed.
                await tx.update(documents)
                    .set({
                        processingStatus: 'completed',
                        processingError: null,
                        templateProfileId: templateResult.diagnostics.profileId,
                        templateMatched: templateResult.diagnostics.matched,
                        templateMatchScore: templateResult.diagnostics.matchScore,
                        templateBoilerplateChunks: templateResult.diagnostics.boilerplateChunks,
                        templateDetectionMode: templateResult.diagnostics.detectionMode === 'none'
                            ? null
                            : templateResult.diagnostics.detectionMode,
                        templateWarnings: templateResult.diagnostics.warnings.length > 0
                            ? templateResult.diagnostics.warnings
                            : null,
                        ocrRescueApplied: ocrRescue.applied,
                        ocrRescueEngine: ocrRescue.engine,
                        ocrRescueFallbackEngine: ocrRescue.fallbackEngine,
                        ocrRescueChunksRecovered: Math.max(0, ocrRescue.chunksAfter - ocrRescue.chunksBefore),
                        ocrRescueWarnings: ocrRescue.warnings.length > 0
                            ? ocrRescue.warnings
                            : null,
                        updatedAt: new Date(),
                    })
                    .where(eq(documents.id, doc.id));

                devLog('   Document status: completed');
            });
        } catch (error) {
            logError('Storage error in ingestion pipeline', { filename, mimeType }, error);
            throw error;
        }
    }

    const storeTimeMs = performance.now() - storeStart;

    // =========================================================================
    // STEP 5: Slang candidate extraction for RAG v2
    // =========================================================================
    const ragV2Flags = getRagV2Flags();
    if (!options.skipStorage && ragV2Flags.graphEnabled && documentId !== 'skipped' && indexedChunkEntries.length > 0) {
        try {
            const allChunkText = indexedChunkEntries.map((entry) => entry.chunk.text).join('\n');
            slangCandidates = await ingestSlangCandidates(allChunkText, {
                sourceType: 'ingest',
                documentId,
            });
            devLog(`   RAG v2 term candidates ingested: ${slangCandidates}`);
        } catch (error) {
            logError('RAG v2 slang candidate ingestion failed', { route: 'ingest', stage: 'slang-candidates' }, error);
        }
    }

    // =========================================================================
    // FINAL: Statistics
    // =========================================================================
    const totalTimeMs = performance.now() - startTime;

    devLog(`\n${'='.repeat(60)}`);
    devLog('Pipeline Complete - Statistics');
    devLog(`${'='.repeat(60)}`);
    devLog(`   Document ID:   ${documentId}`);
    devLog(`   Pages:         ${document.pageCount}`);
    devLog(`   Text blocks:   ${totalTextBlocks}`);
    devLog(`   Chunks:        ${chunks.length}`);
    devLog(`   Indexable:     ${indexedChunkEntries.length}`);
    devLog(`   Boilerplate:   ${boilerplateChunkIndexes.size}`);
    devLog(`   OCR rescue:    ${ocrRescue.attempted ? `${ocrRescue.chunksBefore} -> ${ocrRescue.chunksAfter}` : 'not attempted'}`);
    devLog(`   Total tokens:  ~${totalTokens}`);
    devLog('   -----------------------------');
    devLog(`   Parse time:    ${parseTimeMs.toFixed(0)}ms`);
    devLog(`   Chunk time:    ${chunkTimeMs.toFixed(0)}ms`);
    devLog(`   Embed time:    ${embedTimeMs.toFixed(0)}ms`);
    devLog(`   Store time:    ${storeTimeMs.toFixed(0)}ms`);
    devLog('   -----------------------------');
    devLog(`   Total time:    ${totalTimeMs.toFixed(0)}ms`);
    devLog(`   Slang terms:   ${slangCandidates}`);
    devLog(`${'='.repeat(60)}\n`);

    return {
        documentId,
        document: {
            ...document,
            pages: workingPages,
        },
        chunks,
        template: templateResult.diagnostics,
        ocrRescue,
        stats: {
            parseTimeMs,
            chunkTimeMs,
            embedTimeMs,
            storeTimeMs,
            totalTimeMs,
            pageCount: document.pageCount,
            chunkCount: chunks.length,
            totalTextBlocks,
            totalTokens,
            embeddingApiCalls,
            slangCandidates,
            indexableChunkCount: indexedChunkEntries.length,
            boilerplateChunkCount: boilerplateChunkIndexes.size,
        },
    };
}

// ============================================================================
// CLI Test Runner
// ============================================================================

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        devLog('Usage: npx tsx src/lib/ingest/pipeline.ts <path-to-file> [--skip-db] [--skip-embed]');
        devLog('');
        devLog('Options:');
        devLog('  --skip-db     Skip database storage');
        devLog('  --skip-embed  Skip embedding generation');
        devLog('');
        devLog('Examples:');
        devLog('  npx tsx src/lib/ingest/pipeline.ts ./test.pdf');
        devLog('  npx tsx src/lib/ingest/pipeline.ts ./test.pdf --skip-db');
        process.exit(1);
    }

    const filePath = args[0];
    const skipStorage = args.includes('--skip-db');
    const skipEmbedding = args.includes('--skip-embed');

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : 'text/plain';
    const filename = path.basename(filePath);

    try {
        devLog(`Reading file: ${filePath}`);
        const buffer = await fs.readFile(filePath);

        const result = await processPipeline(buffer, mimeType, filename, {
            skipStorage,
            skipEmbedding,
        });

        // Show chunk preview.
        devLog('Sample Chunks:');
        for (const chunk of result.chunks.slice(0, 2)) {
            devLog(`\n[Chunk ${chunk.index}] Page ${chunk.page}, ~${chunk.tokenCount} tokens`);
            devLog(`   Header: ${chunk.parentHeader || '(none)'}`);
            devLog(`   Preview: "${chunk.text.slice(0, 100).replace(/\n/g, ' ')}..."`);
        }
    } catch (error) {
        logError('Pipeline CLI error', { route: 'ingest', stage: 'cli' }, error);
        process.exit(1);
    }
}

if (require.main === module) {
    void main();
}

// Re-export types
export type { SemanticChunk } from './chunker';
