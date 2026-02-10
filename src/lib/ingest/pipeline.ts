// Load environment variables immediately for CLI/script support
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { parseDocument, ParsedDocument } from './parser';
import { chunkDocument, SemanticChunk, DEFAULT_CHUNKER_CONFIG } from './chunker';
import { embedTexts, isEmbedderConfigured, DEFAULT_EMBEDDER_CONFIG } from './embedder';
import { logResidencyStatus } from '@/lib/config/regions';
import CryptoJS from 'crypto-js';
import fs from 'fs/promises';
import { db } from '@/lib/db';
import { documents, chunks as chunksTable, type BoundingBox } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { devLog, logError } from '@/lib/logger';
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
    };
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

function buildHighlightBoxes(chunk: SemanticChunk): BoundingBox[] | null {
    const sourceBlocks = (chunk as SemanticChunk & { sourceBlocks?: Array<{ bbox: BoundingBox }> }).sourceBlocks;
    if (!Array.isArray(sourceBlocks) || sourceBlocks.length === 0) {
        return chunk.bbox ? [chunk.bbox] : null;
    }

    const dedup = new Map<string, BoundingBox>();
    for (const block of sourceBlocks) {
        const bbox = block?.bbox;
        if (!bbox) continue;
        const key = [
            bbox.x.toFixed(4),
            bbox.y.toFixed(4),
            bbox.width.toFixed(4),
            bbox.height.toFixed(4),
        ].join(':');
        if (!dedup.has(key)) dedup.set(key, bbox);
    }

    const boxes = [...dedup.values()]
        .sort((a, b) => (a.y - b.y) || (a.x - b.x))
        .slice(0, 32);

    if (boxes.length === 0) {
        return chunk.bbox ? [chunk.bbox] : null;
    }

    return boxes;
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
    } = {}
): Promise<PipelineResult> {
    const startTime = performance.now();
    const userId = options.userId;
    const accessLevel = options.accessLevel || 'private';

    if (!options.skipStorage && !userId) {
        throw new Error('userId is required when skipStorage is false.');
    }

    devLog(`\n${'='.repeat(60)}`);
    devLog(`📄 WENKUGPT Ingestion Pipeline`);
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
    devLog('📖 Step 1: Parsing document...');
    const parseStart = performance.now();

    const document = await parseDocument(buffer, mimeType);

    const parseTimeMs = performance.now() - parseStart;
    devLog(`   ✓ Parsed ${document.pageCount} pages in ${parseTimeMs.toFixed(0)}ms`);

    const totalTextBlocks = document.pages.reduce(
        (sum, page) => sum + page.textBlocks.length,
        0
    );
    devLog(`   ✓ Found ${totalTextBlocks} text blocks`);

    // =========================================================================
    // STEP 2: Semantic Chunking
    // =========================================================================
    devLog('\n✂️  Step 2: Semantic chunking...');
    const chunkStart = performance.now();

    const chunks = chunkDocument(document.pages, DEFAULT_CHUNKER_CONFIG);

    const chunkTimeMs = performance.now() - chunkStart;
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

    devLog(`   ✓ Created ${chunks.length} semantic chunks in ${chunkTimeMs.toFixed(0)}ms`);
    devLog(`   ✓ Total tokens: ~${totalTokens}`);

    // =========================================================================
    // STEP 3: Generate Embeddings
    // =========================================================================
    devLog('\n🧠 Step 3: Generating embeddings...');
    const embedStart = performance.now();

    let embeddingApiCalls = 0;
    let chunkEmbeddings: number[][] = [];

    if (options.skipEmbedding || !isEmbedderConfigured()) {
        devLog('   ⚠️ Embedding skipped (API key not configured or skipEmbedding=true)');
        // Create placeholder zero vectors
        chunkEmbeddings = chunks.map(() => new Array(768).fill(0));
    } else {
        const embedResult = await embedTexts(
            chunks.map(c => c.text),
            DEFAULT_EMBEDDER_CONFIG
        );
        chunkEmbeddings = embedResult.embeddings.map(e => e.embedding);
        embeddingApiCalls = embedResult.apiCalls;
        devLog(`   ✓ Generated ${embedResult.embeddings.length} embeddings in ${embedResult.processingTimeMs.toFixed(0)}ms`);
        devLog(`   ✓ API calls: ${embeddingApiCalls}`);
    }

    const embedTimeMs = performance.now() - embedStart;

    // =========================================================================
    // STEP 4: Store in Database
    // =========================================================================
    devLog('\n💾 Step 4: Storing in database...');
    const storeStart = performance.now();

    let documentId = '';
    let slangCandidates = 0;

    if (options.skipStorage) {
        devLog('   ⚠️ Storage skipped (skipStorage=true)');
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
                }).returning();

                documentId = doc.id;
                devLog(`   ✓ Created document: ${documentId}`);

                // Prepare chunk records
                const chunkRecords = chunks.map((chunk, index) => ({
                    documentId: doc.id,
                    content: chunk.text,
                    contentHash: sha256(chunk.text),
                    embedding: chunkEmbeddings[index],
                    pageNumber: chunk.page,
                    boundingBox: chunk.bbox,
                    highlightBoxes: buildHighlightBoxes(chunk),
                    parentHeader: chunk.parentHeader || null,
                    chunkIndex: index,
                    tokenCount: chunk.tokenCount,
                    accessLevel,
                    // Generate simple full-text search vector (Czech dict not available)
                    ftsVector: sql`to_tsvector('simple', ${chunk.text})`,
                }));

                // Batch insert chunks (100 at a time for Supabase)
                const BATCH_SIZE = 100;
                for (let i = 0; i < chunkRecords.length; i += BATCH_SIZE) {
                    const batch = chunkRecords.slice(i, i + BATCH_SIZE);
                    await tx.insert(chunksTable).values(batch);
                    devLog(`   ✓ Inserted chunk batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunkRecords.length / BATCH_SIZE)}`);
                }

                // Update document status to completed
                await tx.update(documents)
                    .set({
                        processingStatus: 'completed',
                        updatedAt: new Date(),
                    })
                    .where(eq(documents.id, doc.id));

                devLog(`   ✓ Document status: completed`);
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
    if (!options.skipStorage && ragV2Flags.graphEnabled && documentId !== 'skipped') {
        try {
            const allChunkText = chunks.map((chunk) => chunk.text).join('\n');
            slangCandidates = await ingestSlangCandidates(allChunkText, {
                sourceType: 'ingest',
                documentId,
            });
            devLog(`   âś“ RAG v2 term candidates ingested: ${slangCandidates}`);
        } catch (error) {
            logError('RAG v2 slang candidate ingestion failed', { route: 'ingest', stage: 'slang-candidates' }, error);
        }
    }

    // =========================================================================
    // FINAL: Statistics
    // =========================================================================
    const totalTimeMs = performance.now() - startTime;

    devLog(`\n${'='.repeat(60)}`);
    devLog(`📊 Pipeline Complete - Statistics`);
    devLog(`${'='.repeat(60)}`);
    devLog(`   Document ID:   ${documentId}`);
    devLog(`   Pages:         ${document.pageCount}`);
    devLog(`   Text blocks:   ${totalTextBlocks}`);
    devLog(`   Chunks:        ${chunks.length}`);
    devLog(`   Total tokens:  ~${totalTokens}`);
    devLog(`   ─────────────────────────────`);
    devLog(`   Parse time:    ${parseTimeMs.toFixed(0)}ms`);
    devLog(`   Chunk time:    ${chunkTimeMs.toFixed(0)}ms`);
    devLog(`   Embed time:    ${embedTimeMs.toFixed(0)}ms`);
    devLog(`   Store time:    ${storeTimeMs.toFixed(0)}ms`);
    devLog(`   ─────────────────────────────`);
    devLog(`   Total time:    ${totalTimeMs.toFixed(0)}ms`);
    devLog(`   Slang terms:   ${slangCandidates}`);
    devLog(`${'='.repeat(60)}\n`);

    return {
        documentId,
        document,
        chunks,
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
        },
    };
}

// ============================================================================
// CLI Test Runner
// ============================================================================

async function main() {
    // Environment variables already loaded at the top

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

        // Show chunk preview
        devLog('📦 Sample Chunks:');
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
    main();
}

// Re-export types
export type { SemanticChunk } from './chunker';
