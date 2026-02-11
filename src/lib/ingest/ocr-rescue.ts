import type { ParsedPage } from './parser';
import {
    chunkDocument,
    DEFAULT_CHUNKER_CONFIG,
    type SemanticChunk,
} from './chunker';

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

export interface OcrRechunkResult {
    chunks: SemanticChunk[];
    usedShortTextFallback: boolean;
}

export function rechunkPagesAfterOcr(pages: ParsedPage[]): OcrRechunkResult {
    const standardChunks = chunkDocument(pages, DEFAULT_CHUNKER_CONFIG);
    if (standardChunks.length > 0) {
        return {
            chunks: standardChunks,
            usedShortTextFallback: false,
        };
    }

    const fallbackChunks = chunkDocument(pages, {
        ...DEFAULT_CHUNKER_CONFIG,
        minTokens: 1,
    });

    return {
        chunks: fallbackChunks,
        usedShortTextFallback: fallbackChunks.length > 0,
    };
}
