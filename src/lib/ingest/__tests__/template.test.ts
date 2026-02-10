import fs from 'fs/promises';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ParsedDocument, ParsedPage, TextBlock } from '../parser';
import {
    classifyBoilerplateChunks,
    computePageVisualHash,
    computeSampledPageNumbers,
    detectTemplateForDocument,
} from '../template';

const PROFILE_DIR = path.join(process.cwd(), 'config', 'template-profiles');

function makeBlock(text: string, page: number, y: number): TextBlock {
    return {
        text,
        page,
        bbox: { x: 0.1, y, width: 0.7, height: 0.06 },
    };
}

function makePage(pageNumber: number, blocks: TextBlock[]): ParsedPage {
    return {
        pageNumber,
        width: 612,
        height: 792,
        textBlocks: blocks,
        fullText: blocks.map((block) => block.text).join(' '),
    };
}

function makeDocument(pages: ParsedPage[]): ParsedDocument {
    return {
        pageCount: pages.length,
        pages,
        metadata: {},
    };
}

async function writeProfile(profile: Record<string, unknown>): Promise<string> {
    const id = String(profile.id);
    const filePath = path.join(PROFILE_DIR, `${id}.json`);
    await fs.mkdir(PROFILE_DIR, { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(profile, null, 2)}\n`, 'utf-8');
    return filePath;
}

async function removeIfExists(filePath: string): Promise<void> {
    try {
        await fs.unlink(filePath);
    } catch {
        // ignore
    }
}

describe('template helpers', () => {
    afterEach(() => {
        delete process.env.TEMPLATE_AWARE_FILTERING_ENABLED;
        delete process.env.TEMPLATE_OCR_FALLBACK_ENABLED;
    });

    it('computes sampled pages with min/max limits', () => {
        expect(computeSampledPageNumbers(2)).toEqual([1, 2]);
        expect(computeSampledPageNumbers(3)).toEqual([1, 2, 3]);
        expect(computeSampledPageNumbers(50).length).toBe(5);
        expect(computeSampledPageNumbers(500).length).toBe(12);
    });

    it('classifies boilerplate chunks from matched profile', () => {
        const chunks = [
            {
                text: 'Agentura Wenku kontakt +420 222 365 709',
                page: 1,
                bbox: { x: 0.05, y: 0.82, width: 0.9, height: 0.1 },
                parentHeader: '',
                index: 0,
                tokenCount: 14,
                sourceBlocks: [],
            },
            {
                text: 'This paragraph contains actual operating guidance.',
                page: 1,
                bbox: { x: 0.2, y: 0.22, width: 0.6, height: 0.12 },
                parentHeader: '',
                index: 1,
                tokenCount: 20,
                sourceBlocks: [],
            },
        ];

        const result = classifyBoilerplateChunks(
            chunks,
            {
                id: 'demo',
                version: 1,
                name: 'Demo',
                anchors: [{ text: 'Agentura Wenku', page: 1 }],
                boilerplatePatterns: ['kontakt', '+420'],
                sampledPages: [],
            },
            true,
        );

        expect(result.has(0)).toBe(true);
        expect(result.has(1)).toBe(false);
    });

    it('detects matching profile and marks boilerplate chunk indexes', async () => {
        process.env.TEMPLATE_AWARE_FILTERING_ENABLED = 'true';
        process.env.TEMPLATE_OCR_FALLBACK_ENABLED = 'false';

        const page = makePage(1, [
            makeBlock('Agentura Wenku', 1, 0.05),
            makeBlock('Kontakt', 1, 0.12),
            makeBlock('Operational policy details for normal procedures.', 1, 0.28),
        ]);
        const document = makeDocument([page]);
        const visualHash = computePageVisualHash(page);
        const profileId = `template-test-${Date.now()}`;
        const profilePath = await writeProfile({
            id: profileId,
            version: 1,
            name: 'Unit test profile',
            matchThreshold: 0.6,
            anchors: [{ text: 'Agentura Wenku', page: 1 }, { text: 'Kontakt', page: 1 }],
            boilerplatePatterns: ['agentura wenku', 'kontakt'],
            sampledPages: [{ page: 1, visualHash }],
        });

        try {
            const chunks = [
                {
                    text: 'Agentura Wenku Kontakt',
                    page: 1,
                    bbox: { x: 0.1, y: 0.08, width: 0.8, height: 0.1 },
                    parentHeader: '',
                    index: 0,
                    tokenCount: 8,
                    sourceBlocks: [],
                },
                {
                    text: 'Operational policy details for normal procedures.',
                    page: 1,
                    bbox: { x: 0.1, y: 0.30, width: 0.8, height: 0.1 },
                    parentHeader: '',
                    index: 1,
                    tokenCount: 11,
                    sourceBlocks: [],
                },
            ];

            const result = await detectTemplateForDocument({
                buffer: Buffer.from('pdf'),
                mimeType: 'application/pdf',
                document,
                chunks,
                templateProfileId: profileId,
            });

            expect(result.diagnostics.profileId).toBe(profileId);
            expect(result.diagnostics.matched).toBe(true);
            expect(result.diagnostics.detectionMode).toBe('text');
            expect(result.boilerplateChunkIndexes.has(0)).toBe(true);
            expect(result.boilerplateChunkIndexes.has(1)).toBe(false);
        } finally {
            await removeIfExists(profilePath);
        }
    });

    it('returns unmatched diagnostics when profile does not match', async () => {
        process.env.TEMPLATE_AWARE_FILTERING_ENABLED = 'true';
        process.env.TEMPLATE_OCR_FALLBACK_ENABLED = 'false';

        const page = makePage(1, [makeBlock('Completely different content body', 1, 0.2)]);
        const document = makeDocument([page]);
        const profileId = `template-test-miss-${Date.now()}`;
        const profilePath = await writeProfile({
            id: profileId,
            version: 1,
            name: 'Strict profile',
            matchThreshold: 0.95,
            anchors: [{ text: 'never present anchor text', page: 1 }],
            boilerplatePatterns: ['never present'],
            sampledPages: [{ page: 1, visualHash: 'does-not-match' }],
        });

        try {
            const result = await detectTemplateForDocument({
                buffer: Buffer.from('pdf'),
                mimeType: 'application/pdf',
                document,
                chunks: [],
                templateProfileId: profileId,
            });

            expect(result.diagnostics.matched).toBe(false);
            expect(result.diagnostics.profileId).toBeNull();
            expect(result.diagnostics.warnings).toContain('low_confidence');
        } finally {
            await removeIfExists(profilePath);
        }
    });
});
