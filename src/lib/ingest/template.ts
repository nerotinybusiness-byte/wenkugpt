import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { BoundingBox } from '@/lib/db/schema';
import { devLog, logWarn } from '@/lib/logger';
import type { SemanticChunk } from './chunker';
import type { ParsedDocument, ParsedPage } from './parser';

const TEMPLATE_PROFILE_DIR = path.join(process.cwd(), 'config', 'template-profiles');
const DEFAULT_MATCH_THRESHOLD = 0.72;
const MAX_OCR_TIMEOUT_MS = 20_000;
const MAX_SAMPLED_PAGES = 12;
const MIN_SAMPLED_PAGES = 3;
const SAMPLE_PERCENT = 0.10;

function readBooleanFlag(name: string, defaultValue = false): boolean {
    const rawValue = process.env[name];
    if (rawValue === undefined) return defaultValue;

    const normalized = rawValue.trim().toLowerCase();
    return normalized === '1'
        || normalized === 'true'
        || normalized === 'yes'
        || normalized === 'on';
}

export type TemplateDetectionMode = 'text' | 'ocr' | 'hybrid' | 'none';

export interface TemplateAnchor {
    text: string;
    page?: number;
    region?: BoundingBox;
    weight?: number;
}

export interface TemplatePageFingerprint {
    page: number;
    visualHash: string;
    tokenHash?: string;
}

export interface TemplateProfile {
    id: string;
    version: number;
    name: string;
    description?: string;
    matchThreshold?: number;
    anchors: TemplateAnchor[];
    boilerplatePatterns?: string[];
    sampledPages?: TemplatePageFingerprint[];
    metadata?: Record<string, unknown>;
}

export interface TemplateDiagnostics {
    profileId: string | null;
    matched: boolean;
    matchScore: number | null;
    detectionMode: TemplateDetectionMode;
    boilerplateChunks: number;
    warnings: string[];
}

export interface TemplateDetectionResult {
    diagnostics: TemplateDiagnostics;
    boilerplateChunkIndexes: Set<number>;
}

interface PageEvidence {
    page: number;
    text: string;
    normalizedText: string;
    hasTextLayer: boolean;
    hasOcrText: boolean;
    visualHash: string;
    tokenHash: string;
    blocks: ParsedPage['textBlocks'];
}

interface LoadedProfiles {
    profiles: TemplateProfile[];
    defaultProfileId: string | null;
    warnings: string[];
}

interface RegistryFile {
    defaultProfileId?: string;
    profiles?: TemplateProfile[];
}

function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function tokenize(value: string): string[] {
    return normalizeText(value)
        .split(/\s+/)
        .filter((token) => token.length >= 3);
}

function getTextBlockSnippet(text: string): string {
    return normalizeText(text).slice(0, 32);
}

function stableHash(parts: string[]): string {
    return createHash('sha256')
        .update(parts.join('|'))
        .digest('hex')
        .slice(0, 24);
}

export function computeSampledPageNumbers(pageCount: number): number[] {
    if (pageCount <= 0) return [];
    const desired = Math.min(
        MAX_SAMPLED_PAGES,
        Math.max(MIN_SAMPLED_PAGES, Math.ceil(pageCount * SAMPLE_PERCENT)),
    );
    const count = Math.min(pageCount, desired);
    return Array.from({ length: count }, (_, index) => index + 1);
}

export function computePageVisualHash(page: ParsedPage): string {
    if (page.textBlocks.length === 0) {
        return stableHash([
            `empty:${Math.round(page.width)}x${Math.round(page.height)}`,
            `page:${page.pageNumber}`,
        ]);
    }

    const packed = page.textBlocks
        .filter((block) => block.text.trim().length > 0)
        .map((block) => {
            const x = Math.round(block.bbox.x * 100);
            const y = Math.round(block.bbox.y * 100);
            const width = Math.round(block.bbox.width * 100);
            const height = Math.round(block.bbox.height * 100);
            const snippet = getTextBlockSnippet(block.text);
            return `${x},${y},${width},${height}:${snippet}`;
        })
        .sort();

    return stableHash(packed);
}

export function computeTextTokenHash(text: string): string {
    const tokens = tokenize(text).slice(0, 160);
    return stableHash(tokens);
}

function isValidBox(value: unknown): value is BoundingBox {
    if (!value || typeof value !== 'object') return false;
    const box = value as BoundingBox;
    return Number.isFinite(box.x)
        && Number.isFinite(box.y)
        && Number.isFinite(box.width)
        && Number.isFinite(box.height);
}

function normalizeAnchor(anchor: unknown): TemplateAnchor | null {
    if (!anchor || typeof anchor !== 'object') return null;
    const candidate = anchor as TemplateAnchor;
    if (typeof candidate.text !== 'string' || candidate.text.trim().length === 0) return null;

    return {
        text: candidate.text.trim(),
        page: Number.isInteger(candidate.page) ? candidate.page : undefined,
        region: isValidBox(candidate.region) ? candidate.region : undefined,
        weight: typeof candidate.weight === 'number' && Number.isFinite(candidate.weight) ? candidate.weight : undefined,
    };
}

function normalizeProfile(value: unknown): TemplateProfile | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as TemplateProfile;
    if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) return null;
    if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) return null;

    const anchors = Array.isArray(candidate.anchors)
        ? candidate.anchors.map(normalizeAnchor).filter((anchor): anchor is TemplateAnchor => Boolean(anchor))
        : [];

    const sampledPages = Array.isArray(candidate.sampledPages)
        ? candidate.sampledPages
            .filter((entry): entry is TemplatePageFingerprint => (
                Boolean(entry)
                && typeof entry.page === 'number'
                && Number.isInteger(entry.page)
                && entry.page > 0
                && typeof entry.visualHash === 'string'
                && entry.visualHash.length > 0
            ))
        : [];

    return {
        id: candidate.id.trim(),
        version: typeof candidate.version === 'number' ? candidate.version : 1,
        name: candidate.name.trim(),
        description: typeof candidate.description === 'string' ? candidate.description : undefined,
        matchThreshold: typeof candidate.matchThreshold === 'number'
            ? Math.max(0, Math.min(1, candidate.matchThreshold))
            : undefined,
        anchors,
        boilerplatePatterns: Array.isArray(candidate.boilerplatePatterns)
            ? candidate.boilerplatePatterns.filter((pattern): pattern is string => (
                typeof pattern === 'string' && pattern.trim().length > 0
            ))
            : [],
        sampledPages,
        metadata: candidate.metadata && typeof candidate.metadata === 'object'
            ? candidate.metadata
            : undefined,
    };
}

async function loadProfilesFromFile(filePath: string): Promise<LoadedProfiles> {
    const text = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(text) as TemplateProfile | RegistryFile;
    const warnings: string[] = [];

    if (Array.isArray((parsed as RegistryFile).profiles)) {
        const registry = parsed as RegistryFile;
        const profiles = registry.profiles
            ?.map((profile) => normalizeProfile(profile))
            .filter((profile): profile is TemplateProfile => Boolean(profile))
            ?? [];
        return {
            profiles,
            defaultProfileId: typeof registry.defaultProfileId === 'string'
                ? registry.defaultProfileId
                : null,
            warnings,
        };
    }

    const single = normalizeProfile(parsed);
    if (!single) {
        warnings.push(`invalid_profile_file:${path.basename(filePath)}`);
        return { profiles: [], defaultProfileId: null, warnings };
    }

    return {
        profiles: [single],
        defaultProfileId: null,
        warnings,
    };
}

export async function loadTemplateProfiles(): Promise<LoadedProfiles> {
    try {
        const entries = await fs.readdir(TEMPLATE_PROFILE_DIR, { withFileTypes: true });
        const files = entries
            .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
            .map((entry) => path.join(TEMPLATE_PROFILE_DIR, entry.name));

        if (files.length === 0) {
            return {
                profiles: [],
                defaultProfileId: null,
                warnings: ['profile_missing'],
            };
        }

        const loaded = await Promise.all(files.map((filePath) => loadProfilesFromFile(filePath)));
        const warnings = loaded.flatMap((result) => result.warnings);
        const profiles = loaded.flatMap((result) => result.profiles);

        const defaultProfileId = loaded.find((result) => result.defaultProfileId)?.defaultProfileId ?? null;

        return {
            profiles,
            defaultProfileId,
            warnings,
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {
                profiles: [],
                defaultProfileId: null,
                warnings: ['profile_missing'],
            };
        }

        logWarn('Failed loading template profiles', { route: 'ingest', stage: 'template-load' }, error);
        return {
            profiles: [],
            defaultProfileId: null,
            warnings: ['profile_load_error'],
        };
    }
}

function computeOverlapRatio(a: BoundingBox, b: BoundingBox): number {
    const left = Math.max(a.x, b.x);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const top = Math.max(a.y, b.y);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    if (right <= left || bottom <= top) return 0;

    const intersection = (right - left) * (bottom - top);
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    if (areaA <= 0 || areaB <= 0) return 0;

    return intersection / Math.min(areaA, areaB);
}

async function extractOcrTextForPages(
    pdfBuffer: Buffer | Uint8Array,
    pages: number[],
): Promise<Map<number, string>> {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        throw new Error('missing_google_api_key');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = [
        'You are an OCR assistant for PDF pages.',
        `Return strict JSON only in this exact shape: {"pages":[{"page":1,"text":"..."},{"page":2,"text":"..."}]}.`,
        `Extract text for these page numbers only: ${pages.join(', ')}.`,
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
            setTimeout(() => reject(new Error('ocr_timeout')), MAX_OCR_TIMEOUT_MS);
        }),
    ]);

    const rawText = result.response.text();
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('ocr_parse_error');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
        pages?: Array<{ page?: number; text?: string }>;
    };

    const map = new Map<number, string>();
    for (const row of parsed.pages ?? []) {
        if (!Number.isInteger(row.page) || (row.page ?? 0) <= 0) continue;
        map.set(row.page!, typeof row.text === 'string' ? row.text : '');
    }

    return map;
}

function resolveDetectionMode(evidence: PageEvidence[]): TemplateDetectionMode {
    const hasText = evidence.some((row) => row.hasTextLayer);
    const hasOcr = evidence.some((row) => row.hasOcrText);
    if (hasText && hasOcr) return 'hybrid';
    if (hasOcr) return 'ocr';
    if (hasText) return 'text';
    return 'none';
}

async function buildPageEvidence(
    document: ParsedDocument,
    pdfBuffer: Buffer | Uint8Array,
    useOcrFallback: boolean,
): Promise<{ evidence: PageEvidence[]; warnings: string[] }> {
    const warnings: string[] = [];
    const sampledPages = computeSampledPageNumbers(document.pageCount);
    const sampledRows = sampledPages
        .map((pageNumber) => document.pages.find((page) => page.pageNumber === pageNumber))
        .filter((page): page is ParsedPage => Boolean(page));

    const needsOcrPages: number[] = [];
    for (const page of sampledRows) {
        const textLength = page.textBlocks.reduce((sum, block) => sum + block.text.trim().length, 0);
        if (textLength < 50) {
            needsOcrPages.push(page.pageNumber);
        }
    }

    let ocrByPage = new Map<number, string>();
    if (needsOcrPages.length > 0 && useOcrFallback) {
        try {
            ocrByPage = await extractOcrTextForPages(pdfBuffer, needsOcrPages);
        } catch (error) {
            const reason = error instanceof Error ? error.message : 'ocr_error';
            warnings.push(reason === 'ocr_timeout' ? 'ocr_timeout' : 'ocr_error');
            logWarn('Template OCR fallback failed', { route: 'ingest', stage: 'template-ocr' }, error);
        }
    } else if (needsOcrPages.length > 0 && !useOcrFallback) {
        warnings.push('ocr_disabled');
    }

    const evidence: PageEvidence[] = sampledRows.map((page) => {
        const textLayerText = page.textBlocks.map((block) => block.text.trim()).filter(Boolean).join(' ');
        const ocrText = (ocrByPage.get(page.pageNumber) || '').trim();
        const mergedText = [textLayerText, ocrText].filter(Boolean).join(' ').trim();
        const hasTextLayer = textLayerText.length >= 50;
        const hasOcrText = ocrText.length > 0;

        return {
            page: page.pageNumber,
            text: mergedText,
            normalizedText: normalizeText(mergedText),
            hasTextLayer,
            hasOcrText,
            visualHash: computePageVisualHash(page),
            tokenHash: computeTextTokenHash(mergedText),
            blocks: page.textBlocks,
        };
    });

    return { evidence, warnings };
}

function evaluateProfile(profile: TemplateProfile, evidence: PageEvidence[]): number {
    if (evidence.length === 0) return 0;

    const evidenceByPage = new Map<number, PageEvidence>(evidence.map((row) => [row.page, row]));

    const visualRows = profile.sampledPages ?? [];
    let visualScore = 0;
    let visualWeight = 0;
    for (const row of visualRows) {
        const target = evidenceByPage.get(row.page);
        if (!target) continue;
        visualWeight += 1;
        if (target.visualHash === row.visualHash) {
            visualScore += 1;
        } else if (row.tokenHash && target.tokenHash === row.tokenHash) {
            visualScore += 0.5;
        }
    }

    const resolvedVisualScore = visualWeight > 0 ? visualScore / visualWeight : 0;

    const anchors = profile.anchors ?? [];
    let anchorScore = 0;
    let anchorWeight = 0;
    for (const anchor of anchors) {
        const weight = anchor.weight ?? 1;
        anchorWeight += weight;

        const normalizedAnchor = normalizeText(anchor.text);
        if (!normalizedAnchor) continue;

        const candidates = anchor.page
            ? evidence.filter((row) => row.page === anchor.page)
            : evidence;

        const match = candidates.some((row) => {
            if (!row.normalizedText.includes(normalizedAnchor)) return false;
            if (!anchor.region) return true;
            if (row.blocks.length === 0) return true;

            return row.blocks.some((block) => (
                normalizeText(block.text).includes(normalizedAnchor)
                && computeOverlapRatio(block.bbox, anchor.region!) >= 0.15
            ));
        });

        if (match) {
            anchorScore += weight;
        }
    }

    const resolvedAnchorScore = anchorWeight > 0 ? anchorScore / anchorWeight : 0;
    if (visualWeight === 0 && anchorWeight === 0) return 0;
    if (visualWeight === 0) return resolvedAnchorScore;
    if (anchorWeight === 0) return resolvedVisualScore;

    return (resolvedAnchorScore * 0.6) + (resolvedVisualScore * 0.4);
}

function resolveTargetProfile(
    profiles: TemplateProfile[],
    profileOverride: string | undefined,
    defaultProfileId: string | null,
): TemplateProfile[] {
    if (profileOverride) {
        const selected = profiles.find((profile) => profile.id === profileOverride);
        return selected ? [selected] : [];
    }

    if (defaultProfileId) {
        const selected = profiles.find((profile) => profile.id === defaultProfileId);
        if (selected) return [selected, ...profiles.filter((profile) => profile.id !== selected.id)];
    }

    return profiles;
}

export function classifyBoilerplateChunks(
    chunks: SemanticChunk[],
    profile: TemplateProfile | null,
    matched: boolean,
): Set<number> {
    if (!profile || !matched) return new Set<number>();

    const patterns = (profile.boilerplatePatterns ?? [])
        .map((pattern) => normalizeText(pattern))
        .filter((pattern) => pattern.length > 0);

    const anchors = profile.anchors ?? [];
    const boilerplate = new Set<number>();

    chunks.forEach((chunk, index) => {
        const normalizedChunk = normalizeText(chunk.text);
        if (!normalizedChunk) return;

        const hasPattern = patterns.some((pattern) => normalizedChunk.includes(pattern));
        if (hasPattern) {
            boilerplate.add(index);
            return;
        }

        const anchored = anchors.some((anchor) => {
            const normalizedAnchor = normalizeText(anchor.text);
            if (!normalizedAnchor || !normalizedChunk.includes(normalizedAnchor)) return false;

            if (anchor.page && chunk.page !== anchor.page) return false;
            if (!anchor.region) return true;

            return computeOverlapRatio(chunk.bbox, anchor.region) >= 0.2;
        });

        if (anchored) {
            boilerplate.add(index);
        }
    });

    return boilerplate;
}

export async function detectTemplateForDocument(params: {
    buffer: Buffer | Uint8Array;
    mimeType: string;
    document: ParsedDocument;
    chunks: SemanticChunk[];
    templateProfileId?: string;
}): Promise<TemplateDetectionResult> {
    const defaults: TemplateDetectionResult = {
        diagnostics: {
            profileId: null,
            matched: false,
            matchScore: null,
            detectionMode: 'none',
            boilerplateChunks: 0,
            warnings: [],
        },
        boilerplateChunkIndexes: new Set<number>(),
    };

    if (params.mimeType !== 'application/pdf') return defaults;

    const featureEnabled = readBooleanFlag('TEMPLATE_AWARE_FILTERING_ENABLED', false);
    if (!featureEnabled) return defaults;

    const ocrEnabled = readBooleanFlag('TEMPLATE_OCR_FALLBACK_ENABLED', false);
    const loaded = await loadTemplateProfiles();
    const warnings = [...loaded.warnings];
    const candidates = resolveTargetProfile(loaded.profiles, params.templateProfileId, loaded.defaultProfileId);

    if (params.templateProfileId && candidates.length === 0) {
        warnings.push('profile_override_not_found');
    }
    if (candidates.length === 0) {
        return {
            diagnostics: {
                ...defaults.diagnostics,
                warnings,
            },
            boilerplateChunkIndexes: new Set<number>(),
        };
    }

    const { evidence, warnings: evidenceWarnings } = await buildPageEvidence(params.document, params.buffer, ocrEnabled);
    warnings.push(...evidenceWarnings);
    const detectionMode = resolveDetectionMode(evidence);

    let bestProfile: TemplateProfile | null = null;
    let bestScore = -1;
    for (const profile of candidates) {
        const score = evaluateProfile(profile, evidence);
        if (score > bestScore) {
            bestScore = score;
            bestProfile = profile;
        }
    }

    if (!bestProfile || bestScore < 0) {
        return {
            diagnostics: {
                profileId: null,
                matched: false,
                matchScore: null,
                detectionMode,
                boilerplateChunks: 0,
                warnings,
            },
            boilerplateChunkIndexes: new Set<number>(),
        };
    }

    const threshold = bestProfile.matchThreshold ?? DEFAULT_MATCH_THRESHOLD;
    const matched = bestScore >= threshold;
    if (!matched) {
        warnings.push('low_confidence');
    }

    const boilerplateChunkIndexes = classifyBoilerplateChunks(params.chunks, bestProfile, matched);
    const diagnostics: TemplateDiagnostics = {
        profileId: matched ? bestProfile.id : null,
        matched,
        matchScore: Number(bestScore.toFixed(4)),
        detectionMode,
        boilerplateChunks: boilerplateChunkIndexes.size,
        warnings,
    };

    devLog(`[template] matched=${diagnostics.matched} score=${diagnostics.matchScore} profile=${diagnostics.profileId ?? 'none'} mode=${diagnostics.detectionMode} filtered=${diagnostics.boilerplateChunks}`);

    return {
        diagnostics,
        boilerplateChunkIndexes,
    };
}

