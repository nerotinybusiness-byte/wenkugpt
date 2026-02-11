import { beforeEach, describe, expect, it, vi } from 'vitest';

function range(from: number, to: number): number[] {
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function mockPdfStack() {
    const render = vi.fn().mockReturnValue({ promise: Promise.resolve() });
    const getViewport = vi.fn().mockReturnValue({ width: 200, height: 300 });
    const getPage = vi.fn().mockResolvedValue({ getViewport, render });
    const destroy = vi.fn();
    const getDocument = vi.fn().mockReturnValue({
        promise: Promise.resolve({ getPage, destroy }),
    });
    vi.doMock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ getDocument }));
    vi.doMock('pdfjs-dist/legacy/build/pdf.worker.mjs', () => ({}));
    return { getDocument, getPage, destroy, getViewport, render };
}

function mockCanvasStack() {
    const getContext = vi.fn().mockReturnValue({});
    const toBuffer = vi.fn().mockReturnValue(Buffer.from('png'));
    const createCanvas = vi.fn().mockReturnValue({ getContext, toBuffer });
    vi.doMock('@napi-rs/canvas', () => ({ createCanvas }));
    return { createCanvas, getContext, toBuffer };
}

describe('tesseract OCR provider', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        delete process.env.OCR_TESSERACT_ENABLED;
    });

    it('returns unavailable when OCR_TESSERACT_ENABLED is false', async () => {
        process.env.OCR_TESSERACT_ENABLED = 'false';
        const { extractOcrTextForPdfPagesWithTesseract } = await import('../ocr-tesseract');

        await expect(extractOcrTextForPdfPagesWithTesseract(Buffer.from('pdf'), [1])).rejects.toThrow(
            'ocr_tesseract_unavailable',
        );
    });

    it('returns unavailable when tesseract worker cannot be created', async () => {
        mockPdfStack();
        mockCanvasStack();
        vi.doMock('tesseract.js', () => ({ createWorker: undefined }));

        const { extractOcrTextForPdfPagesWithTesseract } = await import('../ocr-tesseract');
        await expect(extractOcrTextForPdfPagesWithTesseract(Buffer.from('pdf'), [1])).rejects.toThrow(
            'ocr_tesseract_unavailable',
        );
    });

    it('extracts OCR text for selected pages and trims whitespace', async () => {
        const pdf = mockPdfStack();
        const canvas = mockCanvasStack();
        const recognize = vi.fn()
            .mockResolvedValueOnce({ data: { text: '  Ahoj  ' } })
            .mockResolvedValueOnce({ data: { text: '\nSvet\n' } });
        const terminate = vi.fn();
        const createWorker = vi.fn().mockResolvedValue({ recognize, terminate });
        vi.doMock('tesseract.js', () => ({ createWorker }));

        const { extractOcrTextForPdfPagesWithTesseract } = await import('../ocr-tesseract');
        const map = await extractOcrTextForPdfPagesWithTesseract(Buffer.from('pdf'), [1, 2]);

        expect(createWorker).toHaveBeenCalledWith('ces');
        expect(pdf.getPage).toHaveBeenNthCalledWith(1, 1);
        expect(pdf.getPage).toHaveBeenNthCalledWith(2, 2);
        expect(canvas.createCanvas).toHaveBeenCalledTimes(2);
        expect(recognize).toHaveBeenCalledTimes(2);
        expect(terminate).toHaveBeenCalledTimes(1);
        expect(map.get(1)).toBe('Ahoj');
        expect(map.get(2)).toBe('Svet');
    });

    it('caps tesseract OCR pages to first six candidates', async () => {
        const pdf = mockPdfStack();
        mockCanvasStack();
        const recognize = vi.fn().mockResolvedValue({ data: { text: 'x' } });
        const terminate = vi.fn();
        vi.doMock('tesseract.js', () => ({
            createWorker: vi.fn().mockResolvedValue({ recognize, terminate }),
        }));

        const { extractOcrTextForPdfPagesWithTesseract, TESSERACT_PAGE_SCAN_CAP } = await import('../ocr-tesseract');
        const map = await extractOcrTextForPdfPagesWithTesseract(Buffer.from('pdf'), range(1, 10));

        expect(TESSERACT_PAGE_SCAN_CAP).toBe(6);
        expect(pdf.getPage).toHaveBeenCalledTimes(6);
        expect(recognize).toHaveBeenCalledTimes(6);
        expect(map.size).toBe(6);
    });

    it('throws ocr_timeout when OCR exceeds timeout window', async () => {
        mockPdfStack();
        mockCanvasStack();
        const recognize = vi.fn().mockReturnValue(new Promise<never>(() => { }));
        vi.doMock('tesseract.js', () => ({
            createWorker: vi.fn().mockResolvedValue({ recognize, terminate: vi.fn() }),
        }));

        const { extractOcrTextForPdfPagesWithTesseract } = await import('../ocr-tesseract');
        await expect(
            extractOcrTextForPdfPagesWithTesseract(Buffer.from('pdf'), [1], 5),
        ).rejects.toThrow('ocr_timeout');
    });
});
