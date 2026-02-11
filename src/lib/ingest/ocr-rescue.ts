import type { ParsedPage } from './parser';

export const OCR_LOW_CHUNK_THRESHOLD = 2;
const OCR_PAGE_TEXT_LENGTH_THRESHOLD = 120;
const OCR_PAGE_SCAN_CAP = 20;

function getPageTextLength(page: ParsedPage): number {
    return page.textBlocks.reduce((sum, block) => sum + block.text.trim().length, 0);
}

export function resolveOcrCandidatePages(pages: ParsedPage[]): number[] {
    return pages
        .filter((page) => getPageTextLength(page) < OCR_PAGE_TEXT_LENGTH_THRESHOLD)
        .map((page) => page.pageNumber)
        .sort((a, b) => a - b)
        .slice(0, OCR_PAGE_SCAN_CAP);
}

export function shouldTriggerOcrRescue(mimeType: string, chunkCount: number): boolean {
    return mimeType === 'application/pdf' && chunkCount <= OCR_LOW_CHUNK_THRESHOLD;
}

export function mergeOcrTextIntoPages(
    pages: ParsedPage[],
    ocrByPage: Map<number, string>,
): ParsedPage[] {
    return pages.map((page) => {
        const ocrText = (ocrByPage.get(page.pageNumber) || '').trim();
        if (!ocrText) return page;
        return {
            ...page,
            fullText: [page.fullText, ocrText].filter(Boolean).join('\n').trim(),
        };
    });
}
