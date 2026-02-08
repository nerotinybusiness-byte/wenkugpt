/**
 * WENKUGPT - Ingest API Route
 * 
 * POST /api/ingest
 * Accepts PDF or TXT files and runs the full ingestion pipeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processPipeline } from '@/lib/ingest/pipeline';
import { z } from 'zod';

/**
 * Maximum file size: 50MB
 */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Allowed MIME types
 */
const ALLOWED_TYPES = ['application/pdf', 'text/plain'] as const;

/**
 * Request validation schema
 */
const IngestRequestSchema = z.object({
    accessLevel: z.enum(['public', 'private', 'team']).default('private'),
    skipEmbedding: z.boolean().default(false),
});

/**
 * Response type
 */
interface IngestResponse {
    success: boolean;
    documentId?: string;
    stats?: {
        pageCount: number;
        chunkCount: number;
        totalTokens: number;
        processingTimeMs: number;
    };
    error?: string;
}

/**
 * POST handler for file ingestion
 */
export async function POST(request: NextRequest): Promise<NextResponse<IngestResponse>> {
    try {
        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file');
        const optionsRaw = formData.get('options');

        // Validate file presence
        if (!file || !(file instanceof File)) {
            return NextResponse.json(
                { success: false, error: 'No file provided. Send a file with key "file".' },
                { status: 400 }
            );
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { success: false, error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        // Validate MIME type
        const mimeType = file.type || 'application/octet-stream';
        if (!ALLOWED_TYPES.includes(mimeType as typeof ALLOWED_TYPES[number])) {
            return NextResponse.json(
                { success: false, error: `Unsupported file type: ${mimeType}. Allowed: ${ALLOWED_TYPES.join(', ')}` },
                { status: 400 }
            );
        }

        // Parse options
        let options: { accessLevel: 'public' | 'private' | 'team'; skipEmbedding: boolean } = {
            accessLevel: 'private',
            skipEmbedding: false
        };
        if (optionsRaw && typeof optionsRaw === 'string') {
            try {
                const parsed = JSON.parse(optionsRaw);
                const validated = IngestRequestSchema.safeParse(parsed);
                if (validated.success) {
                    options = validated.data;
                }
            } catch {
                // Use defaults if parsing fails
            }
        }

        // Get file buffer
        const buffer = Buffer.from(await file.arrayBuffer());

        // Sanitize filename to avoid URL encoding issues with diacritics
        // e.g. "Manuál" -> "Manual"
        const sanitizeFilename = (name: string) => {
            return name
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove accents
                .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace special chars with underscore
        };

        const safeFilename = sanitizeFilename(file.name);

        // Upload file to Supabase Storage (Bucket: 'documents')
        const { supabase } = await import('@/lib/supabase');

        console.log(`\n☁️ Uploading ${safeFilename} to Supabase Storage...`);

        const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(safeFilename, buffer, {
                contentType: mimeType,
                upsert: true
            });

        if (uploadError) {
            console.error('❌ Failed to upload to Supabase Storage:', uploadError);
            return NextResponse.json(
                { success: false, error: `Storage Upload Failed: ${uploadError.message}. Make sure 'documents' bucket exists and is public.` },
                { status: 500 }
            );
        }

        console.log(`\n✅ Upload successful`);

        // Run the ingestion pipeline (USE SAFE FILENAME for consistency)
        console.log(`\n🚀 API: Starting ingestion for ${safeFilename} (orig: ${safeFilename})`);

        const result = await processPipeline(buffer, mimeType, safeFilename, {
            accessLevel: options.accessLevel,
            skipEmbedding: options.skipEmbedding,
        });

        return NextResponse.json({
            success: true,
            documentId: result.documentId,
            stats: {
                pageCount: result.stats.pageCount,
                chunkCount: result.stats.chunkCount,
                totalTokens: result.stats.totalTokens,
                processingTimeMs: Math.round(result.stats.totalTimeMs),
            },
        });

    } catch (error) {
        console.error('❌ Ingest API error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}

/**
 * GET handler - return API info
 */
export async function GET(): Promise<NextResponse> {
    return NextResponse.json({
        name: 'WENKUGPT Ingest API',
        version: '1.0.0',
        endpoints: {
            POST: {
                description: 'Upload and process a document',
                body: 'multipart/form-data',
                fields: {
                    file: 'PDF or TXT file (required)',
                    options: 'JSON string with { accessLevel?: "public"|"private"|"team", skipEmbedding?: boolean }',
                },
            },
        },
        limits: {
            maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
            allowedTypes: ALLOWED_TYPES,
        },
    });
}
