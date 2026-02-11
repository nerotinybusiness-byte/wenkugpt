import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('settings store ingest OCR flag', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('defaults emptyChunkOcrEnabled to false', async () => {
        const { useSettings } = await import('@/lib/settings/store');
        expect(useSettings.getState().emptyChunkOcrEnabled).toBe(false);
        expect(useSettings.getState().emptyChunkOcrEngine).toBe('gemini');
    });

    it('setter updates emptyChunkOcrEnabled state', async () => {
        const { useSettings } = await import('@/lib/settings/store');
        useSettings.getState().setEmptyChunkOcrEnabled(true);
        expect(useSettings.getState().emptyChunkOcrEnabled).toBe(true);
    });

    it('resetToDefaults restores emptyChunkOcrEnabled=false', async () => {
        const { useSettings } = await import('@/lib/settings/store');
        useSettings.getState().setEmptyChunkOcrEnabled(true);
        useSettings.getState().setEmptyChunkOcrEngine('tesseract');
        expect(useSettings.getState().emptyChunkOcrEnabled).toBe(true);
        expect(useSettings.getState().emptyChunkOcrEngine).toBe('tesseract');
        useSettings.getState().resetToDefaults();
        expect(useSettings.getState().emptyChunkOcrEnabled).toBe(false);
        expect(useSettings.getState().emptyChunkOcrEngine).toBe('gemini');
    });

    it('setter updates emptyChunkOcrEngine state', async () => {
        const { useSettings } = await import('@/lib/settings/store');
        useSettings.getState().setEmptyChunkOcrEngine('tesseract');
        expect(useSettings.getState().emptyChunkOcrEngine).toBe('tesseract');
    });

    it('persist migration injects default gemini OCR engine', async () => {
        const { migratePersistedSettings } = await import('@/lib/settings/store');
        const migrated = migratePersistedSettings({
            ragEngine: 'v1',
            emptyChunkOcrEnabled: true,
        }, 6) as { emptyChunkOcrEngine?: string };

        expect(migrated.emptyChunkOcrEngine).toBe('gemini');
    });
});
