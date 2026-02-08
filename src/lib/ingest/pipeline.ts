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

/**
 * Temporary user ID until Google SSO is implemented
 */
const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

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
    } = {}
): Promise<PipelineResult> {
    const startTime = performance.now();
    const userId = options.userId || TEMP_USER_ID;
    const accessLevel = options.accessLevel || 'private';

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 WENKUGPT Ingestion Pipeline`);
    console.log(`${'='.repeat(60)}`);
    console.log(`File: ${filename}`);
    console.log(`Type: ${mimeType}`);
    console.log(`Size: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`Access: ${accessLevel}`);
    logResidencyStatus();
    console.log(`${'='.repeat(60)}\n`);

    // =========================================================================
    // STEP 1: Parse Document
    // =========================================================================
    console.log('📖 Step 1: Parsing document...');
    const parseStart = performance.now();

    const document = await parseDocument(buffer, mimeType);

    const parseTimeMs = performance.now() - parseStart;
    console.log(`   ✓ Parsed ${document.pageCount} pages in ${parseTimeMs.toFixed(0)}ms`);

    const totalTextBlocks = document.pages.reduce(
        (sum, page) => sum + page.textBlocks.length,
        0
    );
    console.log(`   ✓ Found ${totalTextBlocks} text blocks`);

    // =========================================================================
    // STEP 2: Semantic Chunking
    // =========================================================================
    console.log('\n✂️  Step 2: Semantic chunking...');
    const chunkStart = performance.now();

    const chunks = chunkDocument(document.pages, DEFAULT_CHUNKER_CONFIG);

    const chunkTimeMs = performance.now() - chunkStart;
    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

    console.log(`   ✓ Created ${chunks.length} semantic chunks in ${chunkTimeMs.toFixed(0)}ms`);
    console.log(`   ✓ Total tokens: ~${totalTokens}`);

    // =========================================================================
    // STEP 3: Generate Embeddings
    // =========================================================================
    console.log('\n🧠 Step 3: Generating embeddings...');
    const embedStart = performance.now();

    let embeddingApiCalls = 0;
    let chunkEmbeddings: number[][] = [];

    if (options.skipEmbedding || !isEmbedderConfigured()) {
        console.log('   ⚠️ Embedding skipped (API key not configured or skipEmbedding=true)');
        // Create placeholder zero vectors
        chunkEmbeddings = chunks.map(() => new Array(768).fill(0));
    } else {
        const embedResult = await embedTexts(
            chunks.map(c => c.text),
            DEFAULT_EMBEDDER_CONFIG
        );
        chunkEmbeddings = embedResult.embeddings.map(e => e.embedding);
        embeddingApiCalls = embedResult.apiCalls;
        console.log(`   ✓ Generated ${embedResult.embeddings.length} embeddings in ${embedResult.processingTimeMs.toFixed(0)}ms`);
        console.log(`   ✓ API calls: ${embeddingApiCalls}`);
    }

    const embedTimeMs = performance.now() - embedStart;

    // =========================================================================
    // STEP 4: Store in Database
    // =========================================================================
    console.log('\n💾 Step 4: Storing in database...');
    const storeStart = performance.now();

    let documentId = '';

    if (options.skipStorage) {
        console.log('   ⚠️ Storage skipped (skipStorage=true)');
        documentId = 'skipped';
    } else {
        try {
            // Late load DB and schema after env vars are ready
            const { db } = await import('@/lib/db');
            const { documents, chunks: chunksTable } = await import('@/lib/db/schema');
            const { eq, sql } = await import('drizzle-orm');

            // Create document record
            const fileHash = sha256(buffer);

            const [doc] = await db.insert(documents).values({
                userId,
                filename,
                fileHash,
                mimeType,
                fileSize: buffer.length,
                pageCount: document.pageCount,
                accessLevel,
                processingStatus: 'processing',
            }).returning();

            documentId = doc.id;
            console.log(`   ✓ Created document: ${documentId}`);

            // Prepare chunk records
            const chunkRecords = chunks.map((chunk, index) => ({
                documentId: doc.id,
                content: chunk.text,
                contentHash: sha256(chunk.text),
                embedding: chunkEmbeddings[index],
                pageNumber: chunk.page,
                boundingBox: chunk.bbox,
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
                await db.insert(chunksTable).values(batch);
                console.log(`   ✓ Inserted chunk batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunkRecords.length / BATCH_SIZE)}`);
            }

            // Update document status to completed
            await db.update(documents)
                .set({
                    processingStatus: 'completed',
                    updatedAt: new Date(),
                })
                .where(eq(documents.id, doc.id));

            console.log(`   ✓ Document status: completed`);
        } catch (error) {
            console.error('   ❌ Storage error:', error);

            // Log to file for debugging
            const fs = await import('fs/promises');
            const timestamp = new Date().toISOString();
            const errorLog = `\n[${timestamp}] PIPELINE ERROR: ${error instanceof Error ? error.stack : String(error)}\n`;
            await fs.appendFile('pipeline-error.log', errorLog);

            throw error;
        }
    }

    const storeTimeMs = performance.now() - storeStart;

    // =========================================================================
    // FINAL: Statistics
    // =========================================================================
    const totalTimeMs = performance.now() - startTime;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Pipeline Complete - Statistics`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   Document ID:   ${documentId}`);
    console.log(`   Pages:         ${document.pageCount}`);
    console.log(`   Text blocks:   ${totalTextBlocks}`);
    console.log(`   Chunks:        ${chunks.length}`);
    console.log(`   Total tokens:  ~${totalTokens}`);
    console.log(`   ─────────────────────────────`);
    console.log(`   Parse time:    ${parseTimeMs.toFixed(0)}ms`);
    console.log(`   Chunk time:    ${chunkTimeMs.toFixed(0)}ms`);
    console.log(`   Embed time:    ${embedTimeMs.toFixed(0)}ms`);
    console.log(`   Store time:    ${storeTimeMs.toFixed(0)}ms`);
    console.log(`   ─────────────────────────────`);
    console.log(`   Total time:    ${totalTimeMs.toFixed(0)}ms`);
    console.log(`${'='.repeat(60)}\n`);

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
        console.log('Usage: npx tsx src/lib/ingest/pipeline.ts <path-to-file> [--skip-db] [--skip-embed]');
        console.log('');
        console.log('Options:');
        console.log('  --skip-db     Skip database storage');
        console.log('  --skip-embed  Skip embedding generation');
        console.log('');
        console.log('Examples:');
        console.log('  npx tsx src/lib/ingest/pipeline.ts ./test.pdf');
        console.log('  npx tsx src/lib/ingest/pipeline.ts ./test.pdf --skip-db');
        process.exit(1);
    }

    const filePath = args[0];
    const skipStorage = args.includes('--skip-db');
    const skipEmbedding = args.includes('--skip-embed');

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : 'text/plain';
    const filename = path.basename(filePath);

    try {
        console.log(`Reading file: ${filePath}`);
        const buffer = await fs.readFile(filePath);

        const result = await processPipeline(buffer, mimeType, filename, {
            skipStorage,
            skipEmbedding,
        });

        // Show chunk preview
        console.log('📦 Sample Chunks:');
        for (const chunk of result.chunks.slice(0, 2)) {
            console.log(`\n[Chunk ${chunk.index}] Page ${chunk.page}, ~${chunk.tokenCount} tokens`);
            console.log(`   Header: ${chunk.parentHeader || '(none)'}`);
            console.log(`   Preview: "${chunk.text.slice(0, 100).replace(/\n/g, ' ')}..."`);
        }

    } catch (error) {
        console.error('❌ Pipeline error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

// Re-export types
export type { SemanticChunk } from './chunker';
