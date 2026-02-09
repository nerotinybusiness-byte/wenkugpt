/**
 * WENKUGPT - PDF Parser
 * 
 * Extracts text and normalized bounding boxes from PDF documents.
 * Coordinates are normalized to 0.0-1.0 percentages with Y-axis flipped
 * (PDF origin is bottom-left, we convert to top-left for web rendering).
 * 
 * Uses dynamic imports for ESM compatibility with pdf-parse and pdfjs-dist.
 */

import type { BoundingBox } from '@/lib/db/schema';

/**
 * Represents a text block extracted from a PDF with its position
 */
export interface TextBlock {
    /** The extracted text content */
    text: string;
    /** Page number (1-indexed) */
    page: number;
    /** Normalized bounding box (0.0-1.0) */
    bbox: BoundingBox;
}

/**
 * Represents a full page of extracted content
 */
export interface ParsedPage {
    /** Page number (1-indexed) */
    pageNumber: number;
    /** Page width in PDF points */
    width: number;
    /** Page height in PDF points */
    height: number;
    /** All text blocks on this page */
    textBlocks: TextBlock[];
    /** Concatenated plain text of the page */
    fullText: string;
}

/**
 * Result of parsing a PDF document
 */
export interface ParsedDocument {
    /** Total number of pages */
    pageCount: number;
    /** All parsed pages */
    pages: ParsedPage[];
    /** Metadata from PDF */
    metadata: {
        title?: string;
        author?: string;
        subject?: string;
        creator?: string;
    };
}

/**
 * Ensure PDF.js node polyfills exist in server runtime.
 * pdf-parse/pdfjs may require DOMMatrix/ImageData/Path2D on Vercel Node runtime.
 */
async function ensurePdfNodePolyfills(): Promise<void> {
    if (typeof window !== 'undefined') return;

    const globalPolyfills = globalThis as Record<string, unknown>;
    if (globalPolyfills.DOMMatrix && globalPolyfills.ImageData && globalPolyfills.Path2D) {
        return;
    }

    const loadCanvasModule = async (): Promise<Record<string, unknown>> => {
        try {
            const imported = await import('@napi-rs/canvas');
            return imported as unknown as Record<string, unknown>;
        } catch (importError) {
            try {
                const { createRequire } = await import('module');
                const path = await import('path');
                const require = createRequire(path.join(process.cwd(), 'package.json'));
                return require('@napi-rs/canvas') as Record<string, unknown>;
            } catch (requireError) {
                const importMessage = importError instanceof Error ? importError.message : 'Unknown import error';
                const requireMessage = requireError instanceof Error ? requireError.message : 'Unknown require error';
                throw new Error(`Cannot load @napi-rs/canvas (${importMessage}; ${requireMessage})`);
            }
        }
    };

    try {
        const rawCanvas = await loadCanvasModule();
        const canvasDefault = rawCanvas.default;
        const canvas = (
            canvasDefault && typeof canvasDefault === 'object'
                ? { ...rawCanvas, ...(canvasDefault as Record<string, unknown>) }
                : rawCanvas
        );

        if (!globalPolyfills.DOMMatrix && canvas.DOMMatrix) {
            globalPolyfills.DOMMatrix = canvas.DOMMatrix;
        }
        if (!globalPolyfills.ImageData && canvas.ImageData) {
            globalPolyfills.ImageData = canvas.ImageData;
        }
        if (!globalPolyfills.Path2D && canvas.Path2D) {
            globalPolyfills.Path2D = canvas.Path2D;
        }
    } catch (error) {
        throw new Error(
            `PDF runtime polyfill init failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }

    const missing = ['DOMMatrix', 'ImageData', 'Path2D'].filter(
        (name) => !globalPolyfills[name]
    );

    if (missing.length > 0) {
        throw new Error(
            `PDF runtime polyfill init failed: Missing ${missing.join(', ')}. Ensure @napi-rs/canvas is available in runtime dependencies.`
        );
    }
}

/**
 * Normalize PDF coordinates to 0.0-1.0 range with Y-axis flip
 * 
 * PDF coordinate system:
 * - Origin at bottom-left
 * - Y increases upward
 * 
 * Web coordinate system:
 * - Origin at top-left
 * - Y increases downward
 * 
 * @param x - Raw X coordinate in PDF points
 * @param y - Raw Y coordinate in PDF points
 * @param width - Text width in PDF points
 * @param height - Text height in PDF points
 * @param pageWidth - Page width in PDF points
 * @param pageHeight - Page height in PDF points
 * @returns Normalized bounding box (0.0-1.0)
 */
function normalizeBoundingBox(
    x: number,
    y: number,
    width: number,
    height: number,
    pageWidth: number,
    pageHeight: number
): BoundingBox {
    // Normalize to 0.0-1.0
    const normalizedX = Math.max(0, Math.min(1, x / pageWidth));
    const normalizedWidth = Math.max(0, Math.min(1 - normalizedX, width / pageWidth));

    // Flip Y-axis: PDF y is from bottom, web y is from top
    // PDF: y=0 at bottom, y=pageHeight at top
    // Web: y=0 at top, y=1 at bottom
    const pdfTopY = y + height; // Top of text in PDF coords
    const normalizedY = Math.max(0, Math.min(1, 1 - (pdfTopY / pageHeight)));
    const normalizedHeight = Math.max(0, Math.min(1 - normalizedY, height / pageHeight));

    return {
        x: normalizedX,
        y: normalizedY,
        width: normalizedWidth,
        height: normalizedHeight,
    };
}

// Type definitions for pdfjs-dist items
interface PDFTextItem {
    str: string;
    transform: number[];
    width?: number;
    height?: number;
}

interface PDFTextContent {
    items: Array<PDFTextItem | { type: string }>;
}

interface PDFPageProxy {
    getViewport(options: { scale: number }): { width: number; height: number };
    getTextContent(): Promise<PDFTextContent>;
}

interface PDFParseInstance {
    getInfo(): Promise<{
        info?: {
            Title?: string;
            Author?: string;
            Subject?: string;
            Creator?: string;
        };
    }>;
    load?: () => Promise<{ numPages: number; getPage(pageNumber: number): Promise<PDFPageProxy> }>;
    destroy?: () => Promise<void> | void;
}

interface PDFParseClass {
    new (options: { data: Uint8Array }): PDFParseInstance;
    setWorker(workerSrc: string): void;
}

interface PDFParseModule {
    PDFParse?: PDFParseClass;
    default?: Record<string, unknown>;
}

/**
 * Type guard to check if item is TextItem (has 'str' property)
 */
function isTextItem(item: PDFTextItem | { type: string }): item is PDFTextItem {
    return 'str' in item && typeof (item as PDFTextItem).str === 'string';
}

/**
 * Extract text blocks with positions from a single PDF page
 */
async function extractPageContent(
    page: PDFPageProxy,
    pageNumber: number
): Promise<ParsedPage> {
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const textBlocks: TextBlock[] = [];
    const textParts: string[] = [];

    for (const item of textContent.items) {
        if (!isTextItem(item)) continue;
        if (!item.str.trim()) continue; // Skip empty strings

        // Get transform matrix [a, b, c, d, e, f]
        // e = x position, f = y position
        // a = horizontal scale (approximately width per character)
        const transform = item.transform;
        const x = transform[4];
        const y = transform[5];

        // Estimate dimensions from transform and string length
        const fontSize = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
        const textWidth = item.width || (item.str.length * fontSize * 0.6);
        const textHeight = item.height || fontSize;

        const bbox = normalizeBoundingBox(
            x,
            y,
            textWidth,
            textHeight,
            viewport.width,
            viewport.height
        );

        textBlocks.push({
            text: item.str,
            page: pageNumber,
            bbox,
        });

        textParts.push(item.str);
    }

    return {
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        textBlocks,
        fullText: textParts.join(' '),
    };
}

/**
 * Parse a PDF buffer and extract text with bounding boxes
 * Uses dynamic imports for ESM compatibility
 * 
 * @param buffer - PDF file as Buffer or Uint8Array
 * @returns Parsed document with text and normalized coordinates
 */
export async function parsePDF(buffer: Buffer | Uint8Array): Promise<ParsedDocument> {
    await ensurePdfNodePolyfills();

    const pdfParseModule = await import('pdf-parse') as unknown as PDFParseModule;
    const PDFParse = pdfParseModule.PDFParse
        ?? (pdfParseModule.default?.PDFParse as PDFParseClass | undefined);
    if (!PDFParse) {
        throw new Error('pdf-parse did not expose PDFParse class');
    }

    // Configure worker for Node.js environment
    if (typeof window === 'undefined') {
        const { createRequire } = await import('module');
        const path = await import('path');
        const url = await import('url');
        const require = createRequire(path.join(process.cwd(), 'package.json'));

        // Resolve worker from package to avoid filesystem path assumptions in serverless.
        const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');

        // Use static method on the class to set worker source
        PDFParse.setWorker(url.pathToFileURL(workerPath).href);
    }

    const uint8Array = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    // Instantiate the parser class
    const parser = new PDFParse({
        data: uint8Array,
        // Optional: verbosity: 0 (ERRORS) is default
    });

    try {
        // Get metadata using the class method
        const infoResult = await parser.getInfo();
        const { info } = infoResult;

        // Ensure doc is loaded for page access
        if (typeof parser.load !== 'function') {
            throw new Error('pdf-parse parser instance does not expose load()');
        }
        const pdfDocument = await parser.load();

        const pages: ParsedPage[] = [];

        for (let i = 1; i <= pdfDocument.numPages; i++) {
            const page = await pdfDocument.getPage(i);
            const parsedPage = await extractPageContent(page, i);
            pages.push(parsedPage);
        }

        return {
            pageCount: pdfDocument.numPages,
            pages,
            metadata: {
                title: info?.Title,
                author: info?.Author,
                subject: info?.Subject,
                creator: info?.Creator,
            },
        };
    } finally {
        // Clean up resources if possible
        if (parser.destroy) {
            await parser.destroy();
        }
    }
}

/**
 * Parse a plain text file (TXT)
 * Creates a single "page" with the entire content
 */
export async function parseText(buffer: Buffer | Uint8Array): Promise<ParsedDocument> {
    const text = new TextDecoder('utf-8').decode(buffer);
    const lines = text.split('\n');

    // Create synthetic bounding boxes for each line
    const textBlocks: TextBlock[] = lines
        .filter(line => line.trim())
        .map((line, index) => ({
            text: line,
            page: 1,
            bbox: {
                x: 0,
                y: index / Math.max(lines.length, 1),
                width: 1,
                height: 1 / Math.max(lines.length, 1),
            },
        }));

    return {
        pageCount: 1,
        pages: [{
            pageNumber: 1,
            width: 612,  // Standard letter width in points
            height: 792, // Standard letter height in points
            textBlocks,
            fullText: text,
        }],
        metadata: {},
    };
}

/**
 * Parse a document based on its MIME type
 */
export async function parseDocument(
    buffer: Buffer | Uint8Array,
    mimeType: string
): Promise<ParsedDocument> {
    if (mimeType === 'application/pdf') {
        return parsePDF(buffer);
    } else if (mimeType === 'text/plain') {
        return parseText(buffer);
    } else {
        throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
}
