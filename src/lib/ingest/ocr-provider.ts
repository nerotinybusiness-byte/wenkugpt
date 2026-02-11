import {
    DEFAULT_OCR_TIMEOUT_MS,
    extractOcrTextForPdfPagesWithGemini,
    mapOcrFailureCode,
    type OcrEngine,
} from './ocr';
import {
    extractOcrTextForPdfPagesWithTesseract,
    resolveTesseractCandidatePages,
} from './ocr-tesseract';

export interface OcrProviderRunParams {
    pdfBuffer: Buffer | Uint8Array;
    pages: number[];
    engine: OcrEngine;
    timeoutMs?: number;
}

export interface OcrProviderRunResult {
    ocrByPage: Map<number, string>;
    engine: OcrEngine;
    fallbackEngine: OcrEngine | null;
    engineUsed: OcrEngine | null;
    warnings: string[];
    latencyMs: number;
    pagesProcessed: number;
}

const OCR_ENGINE_IDS = new Set<OcrEngine>(['gemini', 'tesseract']);

export function resolveOcrEngine(value: unknown): OcrEngine {
    if (typeof value !== 'string') return 'gemini';
    const normalized = value.trim().toLowerCase();
    return OCR_ENGINE_IDS.has(normalized as OcrEngine)
        ? normalized as OcrEngine
        : 'gemini';
}

function resolveGeminiPages(pages: number[]): number[] {
    const unique = new Set<number>();
    for (const page of pages) {
        if (Number.isInteger(page) && page > 0) {
            unique.add(page);
        }
    }
    return [...unique].sort((a, b) => a - b);
}

function mapProviderFailureToWarning(error: unknown): string {
    const code = mapOcrFailureCode(error);
    if (code === 'ocr_timeout') return 'ocr_rescue_timeout';
    if (code === 'ocr_missing_api_key') return 'ocr_rescue_missing_api_key';
    if (code === 'ocr_tesseract_unavailable') return 'ocr_rescue_tesseract_unavailable';
    return 'ocr_rescue_error';
}

export async function runOcrRescueProvider(params: OcrProviderRunParams): Promise<OcrProviderRunResult> {
    const engine = resolveOcrEngine(params.engine);
    const timeoutMs = params.timeoutMs ?? DEFAULT_OCR_TIMEOUT_MS;
    const start = performance.now();
    const pagesProcessed = engine === 'tesseract'
        ? resolveTesseractCandidatePages(params.pages).length
        : resolveGeminiPages(params.pages).length;

    try {
        const ocrByPage = engine === 'tesseract'
            ? await extractOcrTextForPdfPagesWithTesseract(params.pdfBuffer, params.pages, timeoutMs)
            : await extractOcrTextForPdfPagesWithGemini(params.pdfBuffer, params.pages, timeoutMs);

        return {
            ocrByPage,
            engine,
            fallbackEngine: null,
            engineUsed: engine,
            warnings: [],
            latencyMs: performance.now() - start,
            pagesProcessed,
        };
    } catch (error) {
        return {
            ocrByPage: new Map<number, string>(),
            engine,
            fallbackEngine: null,
            engineUsed: engine,
            warnings: [mapProviderFailureToWarning(error)],
            latencyMs: performance.now() - start,
            pagesProcessed,
        };
    }
}
