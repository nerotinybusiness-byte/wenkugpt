import { DEFAULT_OCR_TIMEOUT_MS } from './ocr';

export const TESSERACT_PAGE_SCAN_CAP = 6;
const TESSERACT_LANGUAGE = 'ces';

interface PdfPageLike {
    getViewport(options: { scale: number }): { width: number; height: number };
    render(options: { canvasContext: unknown; viewport: unknown }): { promise: Promise<void> };
}

interface PdfDocumentLike {
    getPage(pageNumber: number): Promise<PdfPageLike>;
    destroy?: () => void | Promise<void>;
}

interface TesseractWorkerLike {
    recognize(image: Buffer | Uint8Array): Promise<{ data?: { text?: string } }>;
    terminate?: () => void | Promise<void>;
}

function normalizePages(pages: number[]): number[] {
    const unique = new Set<number>();
    for (const page of pages) {
        if (Number.isInteger(page) && page > 0) {
            unique.add(page);
        }
    }
    return [...unique].sort((a, b) => a - b);
}

function readBooleanFlag(name: string, defaultValue = false): boolean {
    const rawValue = process.env[name];
    if (rawValue === undefined) return defaultValue;

    const normalized = rawValue.trim().toLowerCase();
    return normalized === '1'
        || normalized === 'true'
        || normalized === 'yes'
        || normalized === 'on';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('ocr_timeout')), timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timeoutId);
                resolve(value);
            },
            (error) => {
                clearTimeout(timeoutId);
                reject(error);
            },
        );
    });
}

async function loadPdfDocument(pdfBuffer: Buffer | Uint8Array): Promise<PdfDocumentLike> {
    try {
        const runtime = globalThis as Record<string, unknown>;
        if (typeof window === 'undefined' && !runtime.pdfjsWorker) {
            try {
                // @ts-expect-error pdfjs-dist worker module has no exported type declarations.
                runtime.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
            } catch {
                // Keep pdfjs default worker configuration as fallback.
            }
        }

        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as {
            getDocument: (params: { data: Uint8Array }) => { promise: Promise<PdfDocumentLike> };
        };
        const data = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);
        const loadingTask = pdfjs.getDocument({ data });
        return await loadingTask.promise;
    } catch {
        throw new Error('ocr_tesseract_unavailable');
    }
}

async function loadCanvasFactory(): Promise<(width: number, height: number) => {
    getContext: (type: string) => unknown;
    toBuffer: (mimeType: string) => Buffer;
}> {
    try {
        const canvasModule = await import('@napi-rs/canvas') as unknown as {
            createCanvas?: (width: number, height: number) => {
                getContext: (type: string) => unknown;
                toBuffer: (mimeType: string) => Buffer;
            };
            default?: {
                createCanvas?: (width: number, height: number) => {
                    getContext: (type: string) => unknown;
                    toBuffer: (mimeType: string) => Buffer;
                };
            };
        };

        const createCanvas = canvasModule.createCanvas ?? canvasModule.default?.createCanvas;
        if (typeof createCanvas !== 'function') {
            throw new Error('missing_create_canvas');
        }
        return createCanvas;
    } catch {
        throw new Error('ocr_tesseract_unavailable');
    }
}

async function createTesseractWorker(): Promise<TesseractWorkerLike> {
    try {
        const tesseractModule = await import('tesseract.js') as unknown as {
            createWorker?: (lang?: string) => Promise<TesseractWorkerLike> | TesseractWorkerLike;
            default?: {
                createWorker?: (lang?: string) => Promise<TesseractWorkerLike> | TesseractWorkerLike;
            };
        };
        const createWorker = tesseractModule.createWorker ?? tesseractModule.default?.createWorker;
        if (typeof createWorker !== 'function') {
            throw new Error('missing_create_worker');
        }

        const worker = await createWorker(TESSERACT_LANGUAGE);
        if (!worker || typeof worker.recognize !== 'function') {
            throw new Error('invalid_worker');
        }
        return worker;
    } catch {
        throw new Error('ocr_tesseract_unavailable');
    }
}

async function renderPdfPageToPng(
    page: PdfPageLike,
    createCanvas: (width: number, height: number) => {
        getContext: (type: string) => unknown;
        toBuffer: (mimeType: string) => Buffer;
    },
): Promise<Buffer> {
    const viewport = page.getViewport({ scale: 2.0 });
    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('ocr_tesseract_unavailable');
    }

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas.toBuffer('image/png');
}

export function resolveTesseractCandidatePages(pages: number[]): number[] {
    return normalizePages(pages).slice(0, TESSERACT_PAGE_SCAN_CAP);
}

export async function extractOcrTextForPdfPagesWithTesseract(
    pdfBuffer: Buffer | Uint8Array,
    pages: number[],
    timeoutMs: number = DEFAULT_OCR_TIMEOUT_MS,
): Promise<Map<number, string>> {
    const selectedPages = resolveTesseractCandidatePages(pages);
    if (selectedPages.length === 0) return new Map<number, string>();

    const tesseractEnabled = readBooleanFlag('OCR_TESSERACT_ENABLED', true);
    if (!tesseractEnabled) {
        throw new Error('ocr_tesseract_unavailable');
    }

    const run = async (): Promise<Map<number, string>> => {
        const pdfDocument = await loadPdfDocument(pdfBuffer);
        const createCanvas = await loadCanvasFactory();
        const worker = await createTesseractWorker();
        const ocrByPage = new Map<number, string>();

        try {
            for (const pageNumber of selectedPages) {
                const page = await pdfDocument.getPage(pageNumber);
                const png = await renderPdfPageToPng(page, createCanvas);
                const result = await worker.recognize(png);
                const text = typeof result?.data?.text === 'string'
                    ? result.data.text.trim()
                    : '';
                ocrByPage.set(pageNumber, text);
            }
            return ocrByPage;
        } finally {
            try {
                if (typeof worker.terminate === 'function') {
                    await worker.terminate();
                }
            } catch {
                // Best-effort cleanup only.
            }
            try {
                if (typeof pdfDocument.destroy === 'function') {
                    await pdfDocument.destroy();
                }
            } catch {
                // Best-effort cleanup only.
            }
        }
    };

    return withTimeout(run(), timeoutMs);
}
