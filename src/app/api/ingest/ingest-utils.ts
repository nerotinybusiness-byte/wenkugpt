/**
 * Exported helpers for the ingest route — kept in a separate file
 * so Next.js route constraints (no non-HTTP exports) are satisfied.
 */

import { z } from 'zod';
import { resolveOcrEngine } from '@/lib/ingest/ocr-provider';
import type { OcrEngine } from '@/lib/ingest/ocr';
import { isIngestSchemaHealthError } from '@/lib/db/schema-health';
import { logWarn } from '@/lib/logger';

const IngestRequestSchema = z.object({
    accessLevel: z.enum(['public', 'private', 'team']).default('private'),
    skipEmbedding: z.boolean().default(false),
    templateProfileId: z.string().trim().min(1).max(128).optional(),
    emptyChunkOcrEnabled: z.boolean().optional(),
    emptyChunkOcrEngine: z.any().optional(),
    folderName: z.string().optional(),
});

function sanitizeFolderName(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed.length > 128) return undefined;
    return trimmed;
}

export function parseIngestOptions(formData: FormData): {
    accessLevel: 'public' | 'private' | 'team';
    skipEmbedding: boolean;
    templateProfileId?: string;
    emptyChunkOcrEnabled?: boolean;
    emptyChunkOcrEngine: OcrEngine;
    folderName?: string;
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
                    folderName: sanitizeFolderName(validated.data.folderName),
                };
            }
        } catch (optionsParseError) {
            logWarn('Failed to parse ingest options JSON — using defaults', { route: 'ingest', stage: 'options-parse' }, optionsParseError);
        }
    }

    // Backward compatibility with direct multipart fields
    const legacyAccess = formData.get('accessLevel');
    const legacySkip = formData.get('skipEmbedding');
    const legacyOcrEngine = formData.get('emptyChunkOcrEngine');
    const legacyFolderName = formData.get('folderName');

    const validated = IngestRequestSchema.safeParse({
        accessLevel: typeof legacyAccess === 'string' ? legacyAccess : undefined,
        skipEmbedding: typeof legacySkip === 'string' ? legacySkip === 'true' : undefined,
        emptyChunkOcrEngine: typeof legacyOcrEngine === 'string' ? legacyOcrEngine : undefined,
        folderName: typeof legacyFolderName === 'string' ? legacyFolderName : undefined,
    });

    if (validated.success) {
        return {
            ...validated.data,
            emptyChunkOcrEngine: resolveOcrEngine(validated.data.emptyChunkOcrEngine),
            folderName: sanitizeFolderName(validated.data.folderName),
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
