import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeGeminiResponse(text: string) {
    return Promise.resolve({
        response: {
            text: () => text,
        },
    });
}

describe('extractOcrTextForPdfPagesWithGemini', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
    });

    it('retries once on timeout and succeeds on second attempt', async () => {
        const generateContent = vi.fn()
            .mockRejectedValueOnce(new Error('ocr_timeout'))
            .mockImplementationOnce(() => makeGeminiResponse('{"pages":[{"page":1,"text":"Ahoj"}]}'));
        const getGenerativeModel = vi.fn(() => ({ generateContent }));
        const GoogleGenerativeAI = vi.fn(function GoogleGenerativeAI() {
            return { getGenerativeModel };
        });

        vi.doMock('@google/generative-ai', () => ({ GoogleGenerativeAI }));

        const { extractOcrTextForPdfPagesWithGemini } = await import('../ocr');
        const result = await extractOcrTextForPdfPagesWithGemini(Buffer.from('pdf'), [1], 1000);

        expect(result.get(1)).toBe('Ahoj');
        expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it('retries once on parse error and succeeds on second attempt', async () => {
        const generateContent = vi.fn()
            .mockImplementationOnce(() => makeGeminiResponse('not-json'))
            .mockImplementationOnce(() => makeGeminiResponse('{"pages":[{"page":1,"text":"Nazdar"}]}'));
        const getGenerativeModel = vi.fn(() => ({ generateContent }));
        const GoogleGenerativeAI = vi.fn(function GoogleGenerativeAI() {
            return { getGenerativeModel };
        });

        vi.doMock('@google/generative-ai', () => ({ GoogleGenerativeAI }));

        const { extractOcrTextForPdfPagesWithGemini } = await import('../ocr');
        const result = await extractOcrTextForPdfPagesWithGemini(Buffer.from('pdf'), [1], 1000);

        expect(result.get(1)).toBe('Nazdar');
        expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it('retries once on empty OCR output and returns non-empty second attempt', async () => {
        const generateContent = vi.fn()
            .mockImplementationOnce(() => makeGeminiResponse('{"pages":[{"page":1,"text":"   "}]}'))
            .mockImplementationOnce(() => makeGeminiResponse('{"pages":[{"page":1,"text":"Jiri Zabilansky 603 582 150"}]}'));
        const getGenerativeModel = vi.fn(() => ({ generateContent }));
        const GoogleGenerativeAI = vi.fn(function GoogleGenerativeAI() {
            return { getGenerativeModel };
        });

        vi.doMock('@google/generative-ai', () => ({ GoogleGenerativeAI }));

        const { extractOcrTextForPdfPagesWithGemini } = await import('../ocr');
        const result = await extractOcrTextForPdfPagesWithGemini(Buffer.from('pdf'), [1], 1000);

        expect(result.get(1)).toBe('Jiri Zabilansky 603 582 150');
        expect(generateContent).toHaveBeenCalledTimes(2);
    });

    it('does not retry on non-retryable missing API key error', async () => {
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        const GoogleGenerativeAI = vi.fn();
        vi.doMock('@google/generative-ai', () => ({ GoogleGenerativeAI }));

        const { extractOcrTextForPdfPagesWithGemini } = await import('../ocr');

        await expect(
            extractOcrTextForPdfPagesWithGemini(Buffer.from('pdf'), [1], 1000),
        ).rejects.toThrow('ocr_missing_api_key');

        expect(GoogleGenerativeAI).not.toHaveBeenCalled();
    });

    it('includes Czech extraction constraints in prompt', async () => {
        const generateContent = vi.fn()
            .mockImplementationOnce(() => makeGeminiResponse('{"pages":[{"page":1,"text":"Ahoj"}]}'));
        const getGenerativeModel = vi.fn(() => ({ generateContent }));
        const GoogleGenerativeAI = vi.fn(function GoogleGenerativeAI() {
            return { getGenerativeModel };
        });

        vi.doMock('@google/generative-ai', () => ({ GoogleGenerativeAI }));

        const { extractOcrTextForPdfPagesWithGemini } = await import('../ocr');
        await extractOcrTextForPdfPagesWithGemini(Buffer.from('pdf'), [1, 2], 1000);

        const firstCallArg = generateContent.mock.calls[0]?.[0] as Array<{ text?: string }>;
        const prompt = firstCallArg[0]?.text ?? '';
        expect(prompt).toContain('Extract Czech text');
        expect(prompt).toContain('preserve Czech diacritics exactly');
        expect(prompt).toContain('Extract phone numbers exactly as written');
    });
});
