/**
 * WENKUGPT - Chunker Unit Tests
 * 
 * Tests for semantic chunking functions
 */

import { describe, it, expect } from 'vitest';
import {
    estimateTokenCount,
    mergeBoundingBoxes,
    chunkDocument,
    DEFAULT_CHUNKER_CONFIG,
} from '../chunker';
import type { ParsedPage } from '../parser';

describe('estimateTokenCount', () => {
    it('should estimate tokens for simple English text', () => {
        const text = 'Hello world this is a test';
        const tokens = estimateTokenCount(text);
        // 6 words * 1.5 = 9 tokens
        expect(tokens).toBe(9);
    });

    it('should estimate tokens for Czech text with declensions', () => {
        const text = 'Příliš žluťoučký kůň úpěl ďábelské ódy';
        const tokens = estimateTokenCount(text);
        // 6 words * 1.5 = 9 tokens
        expect(tokens).toBe(9);
    });

    it('should handle empty string', () => {
        const tokens = estimateTokenCount('');
        expect(tokens).toBe(0);
    });

    it('should handle multiple spaces', () => {
        const text = 'word1   word2    word3';
        const tokens = estimateTokenCount(text);
        // 3 words * 1.5 = 4.5 → ceil → 5 tokens
        expect(tokens).toBe(5);
    });
});

describe('mergeBoundingBoxes', () => {
    it('should return zero box for empty array', () => {
        const result = mergeBoundingBoxes([]);
        expect(result).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    });

    it('should return same box for single element', () => {
        const box = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
        const result = mergeBoundingBoxes([box]);
        expect(result).toEqual(box);
    });

    it('should merge two non-overlapping boxes', () => {
        const box1 = { x: 0, y: 0, width: 0.2, height: 0.1 };
        const box2 = { x: 0.5, y: 0.5, width: 0.2, height: 0.1 };
        const result = mergeBoundingBoxes([box1, box2]);

        // Merged box should cover both
        expect(result.x).toBe(0);
        expect(result.y).toBe(0);
        expect(result.width).toBe(0.7); // 0 to 0.7 (0.5 + 0.2)
        expect(result.height).toBe(0.6); // 0 to 0.6 (0.5 + 0.1)
    });

    it('should merge overlapping boxes', () => {
        const box1 = { x: 0.1, y: 0.1, width: 0.3, height: 0.3 };
        const box2 = { x: 0.2, y: 0.2, width: 0.3, height: 0.3 };
        const result = mergeBoundingBoxes([box1, box2]);

        expect(result.x).toBe(0.1);
        expect(result.y).toBe(0.1);
        expect(result.width).toBeCloseTo(0.4); // 0.1 to 0.5
        expect(result.height).toBeCloseTo(0.4); // 0.1 to 0.5
    });
});

describe('chunkDocument', () => {
    it('should not create chunks for text below minTokens threshold', () => {
        const pages: ParsedPage[] = [
            {
                pageNumber: 1,
                width: 612,
                height: 792,
                textBlocks: [
                    { text: 'Hello world', page: 1, bbox: { x: 0, y: 0, width: 0.5, height: 0.05 } },
                ],
                fullText: 'Hello world',
            },
        ];

        const chunks = chunkDocument(pages, DEFAULT_CHUNKER_CONFIG);

        // With minTokens: 50, this small text won't create a chunk
        expect(chunks.length).toBe(0);
    });

    it('should create chunks when text exceeds minTokens', () => {
        // Generate text that's at least 50 tokens (~33 words)
        const longText = Array(40).fill('word').join(' ');

        const pages: ParsedPage[] = [
            {
                pageNumber: 1,
                width: 612,
                height: 792,
                textBlocks: [
                    { text: longText, page: 1, bbox: { x: 0, y: 0, width: 1, height: 0.1 } },
                ],
                fullText: longText,
            },
        ];

        const chunks = chunkDocument(pages, DEFAULT_CHUNKER_CONFIG);

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].page).toBe(1);
        expect(chunks[0].index).toBe(0);
    });

    it('should split long text into multiple chunks', () => {
        // Create very long text (1000 words = ~1500 tokens, should split)
        const longText = Array(1000).fill('word').join(' ');

        const pages: ParsedPage[] = [
            {
                pageNumber: 1,
                width: 612,
                height: 792,
                textBlocks: [
                    { text: longText, page: 1, bbox: { x: 0, y: 0, width: 1, height: 0.9 } },
                ],
                fullText: longText,
            },
        ];

        const chunks = chunkDocument(pages, { ...DEFAULT_CHUNKER_CONFIG, minTokens: 10 });

        // Should split into multiple chunks
        expect(chunks.length).toBeGreaterThan(1);
    });

    it('should assign correct indices to chunks', () => {
        const longText = Array(500).fill('word').join(' ');

        const pages: ParsedPage[] = [
            {
                pageNumber: 1,
                width: 612,
                height: 792,
                textBlocks: [
                    { text: longText, page: 1, bbox: { x: 0, y: 0, width: 1, height: 0.5 } },
                ],
                fullText: longText,
            },
        ];

        const chunks = chunkDocument(pages, { ...DEFAULT_CHUNKER_CONFIG, minTokens: 10 });

        // Verify indices are sequential
        for (let i = 0; i < chunks.length; i++) {
            expect(chunks[i].index).toBe(i);
        }
    });

    it('keeps sourceBlocks page-local when similar text appears on multiple pages', () => {
        const repeatedText = Array(80).fill('sklad wenku adresa informace').join(' ');
        const pages: ParsedPage[] = [
            {
                pageNumber: 1,
                width: 612,
                height: 792,
                textBlocks: [
                    { text: repeatedText, page: 1, bbox: { x: 0.10, y: 0.12, width: 0.35, height: 0.06 } },
                ],
                fullText: repeatedText,
            },
            {
                pageNumber: 2,
                width: 612,
                height: 792,
                textBlocks: [
                    { text: repeatedText, page: 2, bbox: { x: 0.10, y: 0.78, width: 0.35, height: 0.06 } },
                ],
                fullText: repeatedText,
            },
        ];

        const chunks = chunkDocument(pages, { ...DEFAULT_CHUNKER_CONFIG, minTokens: 10 });
        const firstPageChunk = chunks.find((chunk) => chunk.page === 1);

        expect(firstPageChunk).toBeDefined();
        expect(firstPageChunk?.sourceBlocks.length).toBeGreaterThan(0);
        expect(firstPageChunk?.sourceBlocks.every((block) => block.page === 1)).toBe(true);
        expect(firstPageChunk?.bbox.y).toBeCloseTo(0.12);
        expect(firstPageChunk?.bbox.height).toBeCloseTo(0.06);
    });
});

