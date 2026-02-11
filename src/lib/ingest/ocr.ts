import { GoogleGenerativeAI } from '@google/generative-ai';

export const DEFAULT_OCR_TIMEOUT_MS = 20_000;

export type OcrEngine = 'gemini' | 'tesseract';

export type OcrFailureCode =
    | 'ocr_timeout'
    | 'ocr_error'
    | 'ocr_parse_error'
    | 'ocr_missing_api_key'
    | 'ocr_tesseract_unavailable';

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

    const prompt = [
        'You are an OCR assistant for PDF pages.',
        `Return strict JSON only in this exact shape: {"pages":[{"page":1,"text":"..."},{"page":2,"text":"..."}]}.`,
        `Extract text for these page numbers only: ${normalizedPages.join(', ')}.`,
        'If a page has no readable text, return empty text.',
        'Do not include markdown code fences.',
    ].join('\n');

    const pdfData = Buffer.from(pdfBuffer).toString('base64');
    const call = model.generateContent([
        { text: prompt },
        { inlineData: { mimeType: 'application/pdf', data: pdfData } },
    ]);

    const result = await Promise.race([
        call,
        new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('ocr_timeout')), timeoutMs);
        }),
    ]);

    const rawText = result.response.text();
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

export const extractOcrTextForPdfPages = extractOcrTextForPdfPagesWithGemini;
