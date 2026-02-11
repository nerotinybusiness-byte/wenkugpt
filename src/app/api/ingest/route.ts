/**
 * WENKUGPT - Ingest API Route
 *
 * POST /api/ingest
 * Accepts PDF or TXT files and runs the full ingestion pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { processPipeline } from '@/lib/ingest/pipeline';
import { resolveOcrEngine } from '@/lib/ingest/ocr-provider';
import type { OcrEngine } from '@/lib/ingest/ocr';
import { requireAdmin } from '@/lib/auth/request-auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getRequestId, logError } from '@/lib/logger';
import { assertIngestSchemaHealth, isIngestSchemaHealthError } from '@/lib/db/schema-health';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'text/plain'] as const;

const IngestRequestSchema = z.object({
    accessLevel: z.enum(['public', 'private', 'team']).default('private'),
    skipEmbedding: z.boolean().default(false),
    templateProfileId: z.string().trim().min(1).max(128).optional(),
    emptyChunkOcrEnabled: z.boolean().optional(),
    emptyChunkOcrEngine: z.any().optional(),
});

function sanitizeFilename(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveMimeType(file: File): string {
    if (file.type) return file.type;
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'txt') return 'text/plain';
    return 'application/octet-stream';
}

export function parseIngestOptions(formData: FormData): {
    accessLevel: 'public' | 'private' | 'team';
    skipEmbedding: boolean;
    templateProfileId?: string;
    emptyChunkOcrEnabled?: boolean;
    emptyChunkOcrEngine: OcrEngine;
} {
    const optionsRaw = formData.get('options');

    if (typeof optionsRaw === 'string') {
        try {
            const parsed = JSON.parse(optionsRaw);
            const validated = IngestRequestSchema.safeParse(parsed);
            if (validated.success) {
                return {
                    ...validated.data,
                    emptyChunkOcrEngine: resolveOcrEngine(validated.data.emptyChunkOcrEngine),
                };
            }
        } catch {
            // fallback below
        }
    }

    // Backward compatibility with direct multipart fields
    const legacyAccess = formData.get('accessLevel');
    const legacySkip = formData.get('skipEmbedding');
    const legacyOcrEngine = formData.get('emptyChunkOcrEngine');

    const validated = IngestRequestSchema.safeParse({
        accessLevel: typeof legacyAccess === 'string' ? legacyAccess : undefined,
        skipEmbedding: typeof legacySkip === 'string' ? legacySkip === 'true' : undefined,
        emptyChunkOcrEngine: typeof legacyOcrEngine === 'string' ? legacyOcrEngine : undefined,
    });

    if (validated.success) {
        return {
            ...validated.data,
            emptyChunkOcrEngine: resolveOcrEngine(validated.data.emptyChunkOcrEngine),
        };
    }

    return {
        accessLevel: 'private',
        skipEmbedding: false,
        emptyChunkOcrEngine: 'gemini',
    };
}

function isPgColumnError(error: unknown): error is { code: string; message: string } {
    return (
        typeof error === 'object' &&
        error !== null &&
        typeof (error as { code?: unknown }).code === 'string' &&
        typeof (error as { message?: unknown }).message === 'string'
    );
}

export function mapIngestErrorMessage(error: unknown): string {
    if (isIngestSchemaHealthError(error)) {
        return error.message;
    }

    if (isPgColumnError(error) && error.code === '42703') {
        const normalizedPgMessage = error.message.toLowerCase();
        if (normalizedPgMessage.includes('highlight_text')) {
            return 'Database schema mismatch: missing column chunks.highlight_text. Apply migration drizzle/0004_chunks_highlight_text.sql (or run DB migrations) before ingest.';
        }
        return `Database schema mismatch: ${error.message}. Apply pending DB migrations before ingest.`;
    }

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    const normalized = message.toLowerCase();

    if (
        normalized.includes('dommatrix') ||
        normalized.includes('pdf runtime polyfill') ||
        normalized.includes('@napi-rs/canvas')
    ) {
        return 'PDF parser runtime is not configured correctly (DOMMatrix/ImageData/Path2D). Deploy with @napi-rs/canvas and Node runtime.';
    }

    return message;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireAdmin(request);
        if (!auth.ok) return auth.response;

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return apiError(
                'INGEST_FILE_REQUIRED',
                'No file provided. Send a file with key "file".',
                400
            );
        }

        if (file.size > MAX_FILE_SIZE) {
            return apiError(
                'INGEST_FILE_TOO_LARGE',
                `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
                400
            );
        }

        const mimeType = resolveMimeType(file);
        if (!ALLOWED_TYPES.includes(mimeType as typeof ALLOWED_TYPES[number])) {
            return apiError(
                'INGEST_UNSUPPORTED_TYPE',
                `Unsupported file type: ${mimeType}. Allowed: ${ALLOWED_TYPES.join(', ')}`,
                400
            );
        }

        const options = parseIngestOptions(formData);
        const buffer = Buffer.from(await file.arrayBuffer());

        await assertIngestSchemaHealth();

        const safeFilename = sanitizeFilename(file.name);
        const storageFilename = `${auth.user.id}_${randomUUID()}_${safeFilename}`;

        const { supabase } = await import('@/lib/supabase');

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(storageFilename, buffer, {
                contentType: mimeType,
                upsert: false,
            });

        if (uploadError) {
            return apiError(
                'INGEST_STORAGE_UPLOAD_FAILED',
                `Storage Upload Failed: ${uploadError.message}`,
                500
            );
        }

        const result = await processPipeline(buffer, mimeType, storageFilename, {
            userId: auth.user.id,
            accessLevel: options.accessLevel,
            skipEmbedding: options.skipEmbedding,
            originalFilename: file.name,
            templateProfileId: options.templateProfileId,
            emptyChunkOcrEnabled: options.emptyChunkOcrEnabled,
            emptyChunkOcrEngine: options.emptyChunkOcrEngine,
        });

        return apiSuccess({
            documentId: result.documentId,
            stats: {
                pageCount: result.stats.pageCount,
                chunkCount: result.stats.chunkCount,
                indexableChunkCount: result.stats.indexableChunkCount,
                boilerplateChunkCount: result.stats.boilerplateChunkCount,
                totalTokens: result.stats.totalTokens,
                processingTimeMs: Math.round(result.stats.totalTimeMs),
            },
            template: {
                profileId: result.template.profileId,
                matched: result.template.matched,
                matchScore: result.template.matchScore,
                detectionMode: result.template.detectionMode,
                boilerplateChunks: result.template.boilerplateChunks,
                warnings: result.template.warnings,
            },
            ocrRescue: {
                enabled: result.ocrRescue.enabled,
                attempted: result.ocrRescue.attempted,
                applied: result.ocrRescue.applied,
                engine: result.ocrRescue.engine,
                fallbackEngine: result.ocrRescue.fallbackEngine,
                engineUsed: result.ocrRescue.engineUsed,
                chunksBefore: result.ocrRescue.chunksBefore,
                chunksAfter: result.ocrRescue.chunksAfter,
                pagesAttempted: result.ocrRescue.pagesAttempted,
                warnings: result.ocrRescue.warnings,
            },
        });
    } catch (error) {
        const requestId = getRequestId(request);
        logError('Ingest POST error', { route: '/api/ingest', requestId }, error);
        if (isIngestSchemaHealthError(error)) {
            return apiError('INGEST_SCHEMA_MISMATCH', mapIngestErrorMessage(error), 500);
        }
        return apiError('INGEST_FAILED', mapIngestErrorMessage(error), 500);
    }
}

export async function GET(): Promise<NextResponse> {
    return apiSuccess({
        name: 'WENKUGPT Ingest API',
        version: '1.0.0',
        endpoints: {
            POST: {
                description: 'Upload and process a document',
                body: 'multipart/form-data',
                fields: {
                    file: 'PDF or TXT file (required)',
                    options: 'JSON string with { accessLevel?: "public"|"private"|"team", skipEmbedding?: boolean, templateProfileId?: string, emptyChunkOcrEnabled?: boolean, emptyChunkOcrEngine?: "gemini"|"tesseract" }',
                },
            },
        },
        limits: {
            maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
            allowedTypes: ALLOWED_TYPES,
        },
    });
}
