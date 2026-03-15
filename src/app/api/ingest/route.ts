/**
 * WENKUGPT - Ingest API Route
 *
 * POST /api/ingest
 * Accepts PDF or TXT files and runs the full ingestion pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { processPipeline } from '@/lib/ingest/pipeline';
import { requireAdmin } from '@/lib/auth/request-auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getRequestId, logError } from '@/lib/logger';
import { assertIngestSchemaHealth, isIngestSchemaHealthError } from '@/lib/db/schema-health';
import { parseIngestOptions, mapIngestErrorMessage } from './ingest-utils';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'text/plain'] as const;

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
            logError('Ingest storage upload failed', { route: 'ingest', requestId: getRequestId(request), filename: storageFilename }, uploadError);
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
            folderName: options.folderName,
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
        logError('Ingest POST error', { route: 'ingest', requestId }, error);
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
                    options: 'JSON string with { accessLevel?: "public"|"private"|"team", skipEmbedding?: boolean, templateProfileId?: string, emptyChunkOcrEnabled?: boolean, emptyChunkOcrEngine?: "gemini"|"tesseract", folderName?: string }',
                },
            },
        },
        limits: {
            maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
            allowedTypes: ALLOWED_TYPES,
        },
    });
}
