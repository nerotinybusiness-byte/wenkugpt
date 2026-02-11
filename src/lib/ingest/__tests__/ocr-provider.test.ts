import { beforeEach, describe, expect, it, vi } from 'vitest';

const mapOcrFailureCode = (error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ocr_timeout') return 'ocr_timeout' as const;
    if (message === 'ocr_missing_api_key') return 'ocr_missing_api_key' as const;
    if (message === 'ocr_tesseract_unavailable') return 'ocr_tesseract_unavailable' as const;
    return 'ocr_error' as const;
};

describe('runOcrRescueProvider', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete process.env.OCR_TESSERACT_ENABLED;
    });

    it('routes to gemini provider and keeps fallback disabled', async () => {
        const gemini = vi.fn().mockResolvedValue(new Map([[1, 'text']]));
        const tesseract = vi.fn();

        vi.doMock('../ocr', () => ({
            DEFAULT_OCR_TIMEOUT_MS: 20_000,
            extractOcrTextForPdfPagesWithGemini: gemini,
            mapOcrFailureCode,
        }));
        vi.doMock('../ocr-tesseract', () => ({
            extractOcrTextForPdfPagesWithTesseract: tesseract,
            resolveTesseractCandidatePages: (pages: number[]) => pages.slice(0, 6),
        }));

        const { runOcrRescueProvider } = await import('../ocr-provider');
        const result = await runOcrRescueProvider({
            pdfBuffer: Buffer.from('pdf'),
            pages: [1, 2],
            engine: 'gemini',
        });

        expect(gemini).toHaveBeenCalledTimes(1);
        expect(tesseract).not.toHaveBeenCalled();
        expect(result.engine).toBe('gemini');
        expect(result.engineUsed).toBe('gemini');
        expect(result.fallbackEngine).toBeNull();
        expect(result.warnings).toEqual([]);
        expect(result.pagesProcessed).toBe(2);
    });

    it('routes to tesseract provider and keeps fallback disabled', async () => {
        const gemini = vi.fn();
        const tesseract = vi.fn().mockResolvedValue(new Map([[1, 'ocr']]));

        vi.doMock('../ocr', () => ({
            DEFAULT_OCR_TIMEOUT_MS: 20_000,
            extractOcrTextForPdfPagesWithGemini: gemini,
            mapOcrFailureCode,
        }));
        vi.doMock('../ocr-tesseract', () => ({
            extractOcrTextForPdfPagesWithTesseract: tesseract,
            resolveTesseractCandidatePages: (pages: number[]) => pages.slice(0, 6),
        }));

        const { runOcrRescueProvider } = await import('../ocr-provider');
        const result = await runOcrRescueProvider({
            pdfBuffer: Buffer.from('pdf'),
            pages: [1, 2, 3],
            engine: 'tesseract',
        });

        expect(tesseract).toHaveBeenCalledTimes(1);
        expect(gemini).not.toHaveBeenCalled();
        expect(result.engine).toBe('tesseract');
        expect(result.engineUsed).toBe('tesseract');
        expect(result.fallbackEngine).toBeNull();
        expect(result.warnings).toEqual([]);
        expect(result.pagesProcessed).toBe(3);
    });

    it('maps timeout failures to ocr_rescue_timeout warning', async () => {
        const gemini = vi.fn().mockRejectedValue(new Error('ocr_timeout'));

        vi.doMock('../ocr', () => ({
            DEFAULT_OCR_TIMEOUT_MS: 20_000,
            extractOcrTextForPdfPagesWithGemini: gemini,
            mapOcrFailureCode,
        }));
        vi.doMock('../ocr-tesseract', () => ({
            extractOcrTextForPdfPagesWithTesseract: vi.fn(),
            resolveTesseractCandidatePages: (pages: number[]) => pages.slice(0, 6),
        }));

        const { runOcrRescueProvider } = await import('../ocr-provider');
        const result = await runOcrRescueProvider({
            pdfBuffer: Buffer.from('pdf'),
            pages: [1],
            engine: 'gemini',
        });

        expect(result.ocrByPage.size).toBe(0);
        expect(result.engineUsed).toBe('gemini');
        expect(result.fallbackEngine).toBeNull();
        expect(result.warnings).toEqual(['ocr_rescue_timeout']);
    });

    it('maps tesseract unavailable failures to dedicated warning', async () => {
        const tesseract = vi.fn().mockRejectedValue(new Error('ocr_tesseract_unavailable'));

        vi.doMock('../ocr', () => ({
            DEFAULT_OCR_TIMEOUT_MS: 20_000,
            extractOcrTextForPdfPagesWithGemini: vi.fn(),
            mapOcrFailureCode,
        }));
        vi.doMock('../ocr-tesseract', () => ({
            extractOcrTextForPdfPagesWithTesseract: tesseract,
            resolveTesseractCandidatePages: (pages: number[]) => pages.slice(0, 6),
        }));

        const { runOcrRescueProvider } = await import('../ocr-provider');
        const result = await runOcrRescueProvider({
            pdfBuffer: Buffer.from('pdf'),
            pages: [1, 2, 3, 4, 5, 6, 7],
            engine: 'tesseract',
        });

        expect(result.ocrByPage.size).toBe(0);
        expect(result.engineUsed).toBe('tesseract');
        expect(result.fallbackEngine).toBeNull();
        expect(result.warnings).toEqual(['ocr_rescue_tesseract_unavailable']);
        expect(result.pagesProcessed).toBe(6);
    });
});
