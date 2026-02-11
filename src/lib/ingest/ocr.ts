import { GoogleGenerativeAI } from '@google/generative-ai';

export const DEFAULT_OCR_TIMEOUT_MS = 60_000;

export type OcrEngine = 'gemini' | 'tesseract';

export type OcrFailureCode =
    | 'ocr_timeout'
    | 'ocr_error'
    | 'ocr_parse_error'
    | 'ocr_missing_api_key'
    | 'ocr_tesseract_unavailable';

interface GeminiModelLike {
    generateContent(parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>): Promise<{
        response: { text(): string };
    }>;
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

export function mapOcrFailureCode(error: unknown): OcrFailureCode {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ocr_timeout') return 'ocr_timeout';
    if (message === 'ocr_missing_api_key') return 'ocr_missing_api_key';
    if (message === 'ocr_parse_error') return 'ocr_parse_error';
    if (message === 'ocr_tesseract_unavailable') return 'ocr_tesseract_unavailable';
    return 'ocr_error';
}

export function buildGeminiOcrPrompt(pages: number[]): string {
    return [
        'You are an OCR assistant for PDF pages.',
        `Return strict JSON only in this exact shape: {"pages":[{"page":1,"text":"..."},{"page":2,"text":"..."}]}.`,
        `Extract text for these page numbers only: ${pages.join(', ')}.`,
        'Extract Czech text and preserve Czech diacritics exactly as written.',
        'Extract phone numbers exactly as written; do not normalize or alter digits, separators, or spacing.',
        'If a page has no readable text, return empty text.',
        'Do not include markdown code fences.',
    ].join('\n');
}

export function isRetryableGeminiFailure(error: unknown): boolean {
    const code = mapOcrFailureCode(error);
    return code === 'ocr_timeout' || code === 'ocr_parse_error';
}

export function hasAnyNonEmptyText(ocrByPage: Map<number, string>): boolean {
    for (const text of ocrByPage.values()) {
        if (text.trim().length > 0) return true;
    }
    return false;
}

function parseGeminiOcrResponse(rawText: string): Map<number, string> {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('ocr_parse_error');
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]) as {
            pages?: Array<{ page?: number; text?: string }>;
        };

        const map = new Map<number, string>();
        for (const row of parsed.pages ?? []) {
            if (!Number.isInteger(row.page) || (row.page ?? 0) <= 0) continue;
            map.set(row.page!, typeof row.text === 'string' ? row.text : '');
        }
        return map;
    } catch {
        throw new Error('ocr_parse_error');
    }
}

async function runGeminiOcrAttempt(
    model: GeminiModelLike,
    prompt: string,
    pdfData: string,
    timeoutMs: number,
): Promise<Map<number, string>> {
    const call = model.generateContent([
        { text: prompt },
        { inlineData: { mimeType: 'application/pdf', data: pdfData } },
    ]);

    const result = await new Promise<Awaited<typeof call>>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('ocr_timeout')), timeoutMs);
        call.then(
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

    return parseGeminiOcrResponse(result.response.text());
}

export async function extractOcrTextForPdfPagesWithGemini(
    pdfBuffer: Buffer | Uint8Array,
    pages: number[],
    timeoutMs: number = DEFAULT_OCR_TIMEOUT_MS,
): Promise<Map<number, string>> {
    const normalizedPages = normalizePages(pages);
    if (normalizedPages.length === 0) return new Map<number, string>();

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        throw new Error('ocr_missing_api_key');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = buildGeminiOcrPrompt(normalizedPages);
    const pdfData = Buffer.from(pdfBuffer).toString('base64');

    let firstAttempt: Map<number, string>;

    try {
        firstAttempt = await runGeminiOcrAttempt(model, prompt, pdfData, timeoutMs);
    } catch (error) {
        if (!isRetryableGeminiFailure(error)) {
            throw error;
        }
        return runGeminiOcrAttempt(model, prompt, pdfData, timeoutMs);
    }

    if (hasAnyNonEmptyText(firstAttempt)) {
        return firstAttempt;
    }

    try {
        return await runGeminiOcrAttempt(model, prompt, pdfData, timeoutMs);
    } catch (error) {
        throw error;
    }
}

export const extractOcrTextForPdfPages = extractOcrTextForPdfPagesWithGemini;
