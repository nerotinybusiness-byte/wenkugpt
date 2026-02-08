/**
 * WENKUGPT - Semantic Chunker
 * 
 * Splits parsed documents into semantic chunks based on markdown headers.
 * Implements:
 * - Header-based splitting (#, ##, ###)
 * - Max 1200 tokens per chunk
 * - 15% overlap for context continuity
 * - Parent header hierarchy tracking
 * - Merged bounding boxes per chunk
 */

import type { ParsedPage, TextBlock } from './parser';
import type { BoundingBox } from '@/lib/db/schema';

/**
 * Configuration for the chunker
 */
export interface ChunkerConfig {
    /** Maximum tokens per chunk (default: 1200) */
    maxTokens: number;
    /** Overlap percentage between chunks (default: 0.15) */
    overlapPercent: number;
    /** Minimum tokens for a chunk to be created (default: 50) */
    minTokens: number;
}

/**
 * Default chunker configuration
 */
export const DEFAULT_CHUNKER_CONFIG: ChunkerConfig = {
    maxTokens: 1200,
    overlapPercent: 0.15,
    minTokens: 50,
};

/**
 * Represents a semantic chunk with metadata
 */
export interface SemanticChunk {
    /** Chunk content text */
    text: string;
    /** Page number where chunk starts (1-indexed) */
    page: number;
    /** Combined bounding box covering all text blocks in this chunk */
    bbox: BoundingBox;
    /** Parent header hierarchy (e.g., "## Kapitola 1 > ### Sekce A") */
    parentHeader: string;
    /** Index of this chunk within the document */
    index: number;
    /** Approximate token count */
    tokenCount: number;
    /** Original text blocks that make up this chunk */
    sourceBlocks: TextBlock[];
}

/**
 * Internal representation of a header found in the text
 */
interface HeaderInfo {
    /** Header level (1 for #, 2 for ##, 3 for ###) */
    level: number;
    /** Header text content */
    text: string;
    /** Full header string (with # prefix) */
    raw: string;
}

/**
 * Merge multiple bounding boxes into a single box that contains all of them
 */
export function mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox {
    if (boxes.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }

    if (boxes.length === 1) {
        return { ...boxes[0] };
    }

    let minX = boxes[0].x;
    let minY = boxes[0].y;
    let maxX = boxes[0].x + boxes[0].width;
    let maxY = boxes[0].y + boxes[0].height;

    for (const box of boxes.slice(1)) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
    }

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

/**
 * Estimate token count for Czech text
 * Czech typically has ~1.5 tokens per word due to declension and long words
 */
export function estimateTokenCount(text: string): number {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    return Math.ceil(words.length * 1.5);
}

/**
 * Detect if a line starts with a markdown header
 * Returns the header info or null if not a header
 */
function detectHeader(line: string): HeaderInfo | null {
    // Match # at start of line, followed by space and text
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
        return {
            level: match[1].length,
            text: match[2].trim(),
            raw: line,
        };
    }

    // Also detect common header patterns without # (like "1. Kapitola" or "Kapitola 1:")
    const numberedMatch = line.match(/^(\d+\.?\s+)?([A-ZĚŠČŘŽÝÁÍÉ][A-Za-zěščřžýáíéůú\s]+)[:.]?\s*$/);
    if (numberedMatch && line.length < 80) {
        // Treat as level 2 header
        return {
            level: 2,
            text: line.trim(),
            raw: `## ${line.trim()}`,
        };
    }

    return null;
}

/**
 * Build header hierarchy string from current header stack
 */
function buildHeaderHierarchy(headerStack: HeaderInfo[]): string {
    if (headerStack.length === 0) return '';

    return headerStack
        .map(h => `${'#'.repeat(h.level)} ${h.text}`)
        .join(' > ');
}

/**
 * Split text into paragraphs (by double newlines or single newlines between non-empty lines)
 */
function splitIntoParagraphs(text: string): string[] {
    // First try splitting by double newlines
    let paragraphs = text.split(/\n\n+/);

    // If we only got one paragraph, try single newlines
    if (paragraphs.length === 1) {
        paragraphs = text.split(/\n/).filter(p => p.trim().length > 0);
    }

    return paragraphs.filter(p => p.trim().length > 0);
}

/**
 * Create chunks from a segment of text that's too long
 * Splits on paragraph boundaries to maintain coherence
 */
function splitLongSegment(
    text: string,
    maxTokens: number,
    overlapPercent: number
): string[] {
    const paragraphs = splitIntoParagraphs(text);
    const chunks: string[] = [];
    let currentChunk = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
        const paragraphTokens = estimateTokenCount(paragraph);

        // If single paragraph exceeds limit, force split by sentences
        if (paragraphTokens > maxTokens) {
            // Flush current chunk first
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }

            // Split paragraph by sentences
            const sentences = paragraph.split(/(?<=[.!?])\s+/);
            currentChunk = '';
            currentTokens = 0;

            for (const sentence of sentences) {
                const sentenceTokens = estimateTokenCount(sentence);

                // Handle single sentence exceeding maxTokens (e.g. no punctuation)
                if (sentenceTokens > maxTokens) {
                    // Flush current chunk if any
                    if (currentChunk.trim()) {
                        chunks.push(currentChunk.trim());
                        currentChunk = '';
                        currentTokens = 0;
                    }

                    // Split by words
                    const words = sentence.split(/\s+/);
                    for (const word of words) {
                        const wordTokens = estimateTokenCount(word); // approx 2 tokens

                        if (currentTokens + wordTokens > maxTokens && currentChunk.trim()) {
                            chunks.push(currentChunk.trim());
                            // Simple overlap logic: take last 20 words
                            const overlapTokens = Math.floor(maxTokens * overlapPercent);
                            const prevWords = currentChunk.split(/\s+/);
                            // 1.5 tokens per word estimate
                            const wordsToKeep = Math.floor(overlapTokens / 1.5);
                            const overlapStr = prevWords.slice(-wordsToKeep).join(' ');

                            currentChunk = overlapStr + ' ' + word;
                            currentTokens = estimateTokenCount(currentChunk);
                        } else {
                            currentChunk += (currentChunk ? ' ' : '') + word;
                            currentTokens += wordTokens;
                        }
                    }
                    continue;
                }

                if (currentTokens + sentenceTokens > maxTokens && currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                    // Add overlap
                    const overlapTokens = Math.floor(maxTokens * overlapPercent);
                    const words = currentChunk.split(/\s+/);
                    const overlapWords = words.slice(-Math.floor(overlapTokens / 1.5));
                    currentChunk = overlapWords.join(' ') + ' ' + sentence;
                    currentTokens = estimateTokenCount(currentChunk);
                } else {
                    currentChunk += (currentChunk ? ' ' : '') + sentence;
                    currentTokens += sentenceTokens;
                }
            }
            continue;
        }

        // Check if adding this paragraph would exceed limit
        if (currentTokens + paragraphTokens > maxTokens && currentChunk.trim()) {
            chunks.push(currentChunk.trim());

            // Add overlap from end of previous chunk
            const overlapTokens = Math.floor(maxTokens * overlapPercent);
            const words = currentChunk.split(/\s+/);
            const overlapWords = words.slice(-Math.floor(overlapTokens / 1.5));
            currentChunk = overlapWords.join(' ') + '\n\n' + paragraph;
            currentTokens = estimateTokenCount(currentChunk);
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            currentTokens += paragraphTokens;
        }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Find text blocks that are within a text segment
 * Used for merging bounding boxes
 */
function findBlocksForSegment(
    segment: string,
    allBlocks: TextBlock[]
): TextBlock[] {
    const matchingBlocks: TextBlock[] = [];
    const segmentWords = new Set(
        segment.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    );

    for (const block of allBlocks) {
        const blockWords = block.text.toLowerCase().split(/\s+/);
        // Check if any significant words from this block appear in the segment
        const hasMatch = blockWords.some(w => w.length > 3 && segmentWords.has(w));
        if (hasMatch || segment.includes(block.text)) {
            matchingBlocks.push(block);
        }
    }

    return matchingBlocks;
}

/**
 * Main chunking function
 * Takes parsed pages and returns semantic chunks
 */
export function chunkDocument(
    pages: ParsedPage[],
    config: ChunkerConfig = DEFAULT_CHUNKER_CONFIG
): SemanticChunk[] {
    const { maxTokens, overlapPercent, minTokens } = config;
    const chunks: SemanticChunk[] = [];

    // Collect all text blocks for bounding box lookup
    const allBlocks: TextBlock[] = pages.flatMap(p => p.textBlocks);

    // Combine all page text
    const fullText = pages.map(p => p.fullText).join('\n\n');
    const lines = fullText.split('\n');

    // State for building chunks
    const headerStack: HeaderInfo[] = [];
    let currentSegment = '';
    let currentPage = 1;
    let chunkIndex = 0;

    /**
     * Flush the current segment as one or more chunks
     */
    const flushSegment = () => {
        if (!currentSegment.trim()) return;

        const tokenCount = estimateTokenCount(currentSegment);

        // If segment fits within limit, create one chunk
        if (tokenCount <= maxTokens) {
            if (tokenCount >= minTokens) {
                const matchingBlocks = findBlocksForSegment(currentSegment, allBlocks);
                chunks.push({
                    text: currentSegment.trim(),
                    page: currentPage,
                    bbox: mergeBoundingBoxes(matchingBlocks.map(b => b.bbox)),
                    parentHeader: buildHeaderHierarchy(headerStack),
                    index: chunkIndex++,
                    tokenCount,
                    sourceBlocks: matchingBlocks,
                });
            }
        } else {
            // Split long segment
            const subChunks = splitLongSegment(currentSegment, maxTokens, overlapPercent);
            for (const subChunk of subChunks) {
                const subTokenCount = estimateTokenCount(subChunk);
                if (subTokenCount >= minTokens) {
                    const matchingBlocks = findBlocksForSegment(subChunk, allBlocks);
                    chunks.push({
                        text: subChunk,
                        page: currentPage,
                        bbox: mergeBoundingBoxes(matchingBlocks.map(b => b.bbox)),
                        parentHeader: buildHeaderHierarchy(headerStack),
                        index: chunkIndex++,
                        tokenCount: subTokenCount,
                        sourceBlocks: matchingBlocks,
                    });
                }
            }
        }

        currentSegment = '';
    };

    // Track which page we're on
    let accumulatedLength = 0;
    const pageBreaks: number[] = [];
    for (const page of pages) {
        accumulatedLength += page.fullText.length + 2; // +2 for \n\n separator
        pageBreaks.push(accumulatedLength);
    }

    let currentPosition = 0;

    // Process line by line
    for (const line of lines) {
        // Update current page based on position
        currentPosition += line.length + 1;
        let newPage = currentPage;

        for (let i = 0; i < pageBreaks.length; i++) {
            if (currentPosition <= pageBreaks[i]) {
                newPage = i + 1;
                break;
            }
        }

        // If page changed, flush current segment to keep chunks page-aligned
        if (newPage !== currentPage) {
            flushSegment();
            currentPage = newPage;
        }

        const header = detectHeader(line);

        if (header) {
            // Flush previous segment before starting new header section
            flushSegment();

            // Update header stack
            // Remove headers of same or lower level
            while (headerStack.length > 0 && headerStack[headerStack.length - 1].level >= header.level) {
                headerStack.pop();
            }
            headerStack.push(header);

            // Start new segment with header
            currentSegment = line;
        } else {
            // Add line to current segment
            if (line.trim()) {
                currentSegment += (currentSegment ? '\n' : '') + line;
            }
        }
    }

    // Flush any remaining content
    flushSegment();

    return chunks;
}

/**
 * Convenience function with default config
 */
export function chunkPages(pages: ParsedPage[]): SemanticChunk[] {
    return chunkDocument(pages, DEFAULT_CHUNKER_CONFIG);
}
