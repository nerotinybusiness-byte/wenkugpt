import { describe, expect, it } from 'vitest';
import type { ParsedPage } from '../parser';
import {
    mergeOcrTextIntoPages,
    rechunkPagesAfterOcr,
    resolveOcrCandidatePages,
    shouldTriggerOcrRescue,
} from '../ocr-rescue';
import { mapOcrFailureCode } from '../ocr';

function makePage(pageNumber: number, text: string): ParsedPage {
    return {
        pageNumber,
        width: 612,
        height: 792,
        fullText: text,
        textBlocks: text.length > 0
            ? [{
                page: pageNumber,
                text,
                bbox: { x: 0.1, y: 0.1, width: 0.8, height: 0.1 },
            }]
            : [],
    };
}

describe('OCR rescue helpers', () => {
    it('triggers only for PDFs with low chunk count (0, 1, 2)', () => {
        expect(shouldTriggerOcrRescue('application/pdf', 0)).toBe(true);
        expect(shouldTriggerOcrRescue('application/pdf', 1)).toBe(true);
        expect(shouldTriggerOcrRescue('application/pdf', 2)).toBe(true);
        expect(shouldTriggerOcrRescue('application/pdf', 3)).toBe(false);
        expect(shouldTriggerOcrRescue('text/plain', 0)).toBe(false);
    });

    it('selects OCR candidate pages by low text-layer length and applies hard cap', () => {
        const pages = Array.from({ length: 25 }, (_, index) => (
            makePage(index + 1, index < 23 ? 'x'.repeat(30) : 'x'.repeat(150))
        ));

        const candidates = resolveOcrCandidatePages(pages);
        expect(candidates.length).toBe(20);
        expect(candidates[0]).toBe(1);
        expect(candidates[candidates.length - 1]).toBe(20);
    });

    it('merges OCR text into page fullText while preserving other pages', () => {
        const pages = [
            makePage(1, 'Ahoj'),
            makePage(2, ''),
        ];
        const merged = mergeOcrTextIntoPages(pages, new Map([
            [2, 'OCR obsah'],
        ]));

        expect(merged[0].fullText).toBe('Ahoj');
        expect(merged[1].fullText).toContain('OCR obsah');
    });

    it('creates fallback chunk for short OCR text when standard chunking would produce zero chunks', () => {
        const pages = [makePage(1, 'Jiri Zabilansky 603 582 150')];
        const result = rechunkPagesAfterOcr(pages);

        expect(result.usedShortTextFallback).toBe(true);
        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.chunks[0].text).toContain('603 582 150');
    });

    it('keeps zero chunks when OCR text is empty', () => {
        const pages = [makePage(1, '')];
        const result = rechunkPagesAfterOcr(pages);

        expect(result.usedShortTextFallback).toBe(false);
        expect(result.chunks.length).toBe(0);
    });

    it('maps OCR failures to deterministic warning codes', () => {
        expect(mapOcrFailureCode(new Error('ocr_timeout'))).toBe('ocr_timeout');
        expect(mapOcrFailureCode(new Error('ocr_missing_api_key'))).toBe('ocr_missing_api_key');
        expect(mapOcrFailureCode(new Error('ocr_parse_error'))).toBe('ocr_parse_error');
        expect(mapOcrFailureCode(new Error('ocr_tesseract_unavailable'))).toBe('ocr_tesseract_unavailable');
        expect(mapOcrFailureCode(new Error('something_else'))).toBe('ocr_error');
    });
});
