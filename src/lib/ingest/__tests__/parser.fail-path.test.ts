import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const polyfillKeys = ['DOMMatrix', 'ImageData', 'Path2D'] as const;
type PolyfillKey = (typeof polyfillKeys)[number];

const globalPolyfills = globalThis as unknown as Record<PolyfillKey, unknown>;
const originalPolyfills = {} as Record<PolyfillKey, unknown>;

describe('parser fail paths', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        for (const key of polyfillKeys) {
            originalPolyfills[key] = globalPolyfills[key];
            delete globalPolyfills[key];
        }
    });

    afterEach(() => {
        for (const key of polyfillKeys) {
            if (originalPolyfills[key] === undefined) {
                delete globalPolyfills[key];
            } else {
                globalPolyfills[key] = originalPolyfills[key];
            }
        }
    });

    it('throws a clear runtime error when canvas polyfills are missing', async () => {
        vi.doMock('@napi-rs/canvas', () => ({
            default: {},
        }));

        const { parsePDF } = await import('@/lib/ingest/parser');

        await expect(parsePDF(Buffer.from('not-a-real-pdf'))).rejects.toThrow(
            /PDF runtime polyfill init failed: Missing DOMMatrix, ImageData, Path2D/
        );
    });

    it('rejects unsupported mime type in parseDocument', async () => {
        const { parseDocument } = await import('@/lib/ingest/parser');

        await expect(parseDocument(Buffer.from('payload'), 'image/png')).rejects.toThrow(
            'Unsupported MIME type: image/png'
        );
    });
});
