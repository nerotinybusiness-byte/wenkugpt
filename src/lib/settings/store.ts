/**
 * WENKUGPT - Settings Store (Zustand)
 *
 * Reactive state for RAG configuration that updates API behavior in real-time.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Available Gemini models.
 * Keep this list aligned with what the backend can safely execute.
 */
export const GEMINI_MODELS = [
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Stable default for chat generation.',
    },
] as const;

const VALID_GEMINI_MODEL_IDS = new Set<string>(GEMINI_MODELS.map((model) => model.id));

/**
 * Available RAG engine variants.
 */
export const RAG_ENGINES = [
    {
        id: 'v1',
        name: 'RAG v1',
        description: 'Current production pipeline.',
    },
    {
        id: 'v2',
        name: 'RAG v2',
        description: 'Graph-memory capable pipeline (incremental rollout).',
    },
] as const;

export type RAGEngineId = (typeof RAG_ENGINES)[number]['id'];
const VALID_RAG_ENGINE_IDS = new Set<string>(RAG_ENGINES.map((engine) => engine.id));

export const OCR_ENGINES = [
    {
        id: 'gemini',
        name: 'Gemini OCR (recommended)',
        description: 'Higher quality OCR using Gemini model API.',
    },
    {
        id: 'tesseract',
        name: 'Tesseract OCR (lower quality)',
        description: 'Lower-cost local OCR path with weaker scan quality.',
    },
] as const;

export type OcrEngineId = (typeof OCR_ENGINES)[number]['id'];
const VALID_OCR_ENGINE_IDS = new Set<string>(OCR_ENGINES.map((engine) => engine.id));

export const AMBIGUITY_POLICIES = [
    {
        id: 'ask',
        name: 'Ask',
        description: 'Request clarification when meaning is ambiguous.',
    },
    {
        id: 'show_both',
        name: 'Show Both',
        description: 'Return both candidate meanings when conflict exists.',
    },
    {
        id: 'strict',
        name: 'Strict',
        description: 'Fail closed when ambiguity is detected.',
    },
] as const;

export type AmbiguityPolicyId = (typeof AMBIGUITY_POLICIES)[number]['id'];
const VALID_AMBIGUITY_POLICY_IDS = new Set<string>(AMBIGUITY_POLICIES.map((policy) => policy.id));

export interface ContextScopeSettings {
    team: string;
    product: string;
    region: string;
    process: string;
}

/**
 * Available Claude models for auditor.
 */
export const CLAUDE_MODELS = [
    { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', description: 'Fast, economical' },
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', description: 'Balanced' },
    { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', description: 'Most capable' },
] as const;

/**
 * Settings store state.
 */
export interface SettingsState {
    // Engine settings
    ragEngine: RAGEngineId;
    contextScope: ContextScopeSettings;
    effectiveAt: string;
    ambiguityPolicy: AmbiguityPolicyId;

    // Search settings
    vectorWeight: number;
    textWeight: number;
    minScore: number;
    searchLimit: number;

    // Reranker settings
    topK: number;
    minRelevance: number;

    // Model settings
    generatorModel: string;
    auditorModel: string;
    temperature: number;

    // Verification settings
    enableAuditor: boolean;
    confidenceThreshold: number;

    // Ingest settings
    emptyChunkOcrEnabled: boolean;
    emptyChunkOcrEngine: OcrEngineId;

    // Analytics (last request stats)
    lastStats: {
        retrievalTimeMs: number;
        generationTimeMs: number;
        verificationTimeMs: number;
        totalTimeMs: number;
        chunksRetrieved: number;
        chunksUsed: number;
    } | null;

    // Actions
    setRagEngine: (engine: RAGEngineId) => void;
    setContextScopeField: (field: keyof ContextScopeSettings, value: string) => void;
    setEffectiveAt: (effectiveAt: string) => void;
    setAmbiguityPolicy: (policy: AmbiguityPolicyId) => void;
    setVectorWeight: (weight: number) => void;
    setTextWeight: (weight: number) => void;
    setMinScore: (score: number) => void;
    setSearchLimit: (limit: number) => void;
    setTopK: (k: number) => void;
    setMinRelevance: (relevance: number) => void;
    setGeneratorModel: (model: string) => void;
    setAuditorModel: (model: string) => void;
    setTemperature: (temp: number) => void;
    setEnableAuditor: (enabled: boolean) => void;
    setConfidenceThreshold: (threshold: number) => void;
    setEmptyChunkOcrEnabled: (enabled: boolean) => void;
    setEmptyChunkOcrEngine: (engine: OcrEngineId) => void;
    setLastStats: (stats: SettingsState['lastStats']) => void;
    resetToDefaults: () => void;
}

/**
 * Default settings values.
 */
const DEFAULT_SETTINGS = {
    ragEngine: 'v1' as RAGEngineId,
    contextScope: {
        team: '',
        product: '',
        region: '',
        process: '',
    },
    effectiveAt: '',
    ambiguityPolicy: 'show_both' as AmbiguityPolicyId,
    vectorWeight: 0.7,
    textWeight: 0.3,
    minScore: 0.3,
    searchLimit: 20,
    topK: 5,
    minRelevance: 0.3,
    generatorModel: 'gemini-2.5-flash',
    auditorModel: 'claude-3-5-haiku-latest',
    temperature: 0.0,
    enableAuditor: true,
    confidenceThreshold: 0.85,
    emptyChunkOcrEnabled: false,
    emptyChunkOcrEngine: 'gemini' as OcrEngineId,
    lastStats: null,
};

function isPersistedSettingsState(value: unknown): value is Partial<SettingsState> {
    return typeof value === 'object' && value !== null;
}

function sanitizeGeneratorModel(model: unknown): string {
    const candidate = typeof model === 'string' ? model : '';
    return VALID_GEMINI_MODEL_IDS.has(candidate)
        ? candidate
        : DEFAULT_SETTINGS.generatorModel;
}

function sanitizeRagEngine(engine: unknown): RAGEngineId {
    const candidate = typeof engine === 'string' ? engine : '';
    return VALID_RAG_ENGINE_IDS.has(candidate)
        ? (candidate as RAGEngineId)
        : DEFAULT_SETTINGS.ragEngine;
}

function sanitizeAmbiguityPolicy(policy: unknown): AmbiguityPolicyId {
    const candidate = typeof policy === 'string' ? policy : '';
    return VALID_AMBIGUITY_POLICY_IDS.has(candidate)
        ? (candidate as AmbiguityPolicyId)
        : DEFAULT_SETTINGS.ambiguityPolicy;
}

function sanitizeOcrEngine(engine: unknown): OcrEngineId {
    const candidate = typeof engine === 'string' ? engine : '';
    return VALID_OCR_ENGINE_IDS.has(candidate)
        ? (candidate as OcrEngineId)
        : DEFAULT_SETTINGS.emptyChunkOcrEngine;
}

function sanitizeScopeValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function sanitizeContextScope(scope: unknown): ContextScopeSettings {
    if (typeof scope !== 'object' || scope === null) {
        return DEFAULT_SETTINGS.contextScope;
    }

    const record = scope as Partial<ContextScopeSettings>;
    return {
        team: sanitizeScopeValue(record.team),
        product: sanitizeScopeValue(record.product),
        region: sanitizeScopeValue(record.region),
        process: sanitizeScopeValue(record.process),
    };
}

function sanitizeEffectiveAt(value: unknown): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? '' : trimmed;
}

export function migratePersistedSettings(
    persistedState: unknown,
    version: number,
): Partial<SettingsState> {
    if (version === 1) {
        return DEFAULT_SETTINGS;
    }

    if (!isPersistedSettingsState(persistedState)) {
        return DEFAULT_SETTINGS;
    }

    const merged = { ...DEFAULT_SETTINGS, ...persistedState };
    return {
        ...merged,
        ragEngine: sanitizeRagEngine(merged.ragEngine),
        contextScope: sanitizeContextScope(merged.contextScope),
        effectiveAt: sanitizeEffectiveAt(merged.effectiveAt),
        ambiguityPolicy: sanitizeAmbiguityPolicy(merged.ambiguityPolicy),
        generatorModel: sanitizeGeneratorModel(merged.generatorModel),
        emptyChunkOcrEngine: sanitizeOcrEngine(merged.emptyChunkOcrEngine),
    };
}

/**
 * Settings store with persistence.
 */
export const useSettings = create<SettingsState>()(
    persist(
        (set) => ({
            ...DEFAULT_SETTINGS,

            setRagEngine: (engine) => set({ ragEngine: sanitizeRagEngine(engine) }),
            setContextScopeField: (field, value) => set((state) => ({
                contextScope: {
                    ...state.contextScope,
                    [field]: sanitizeScopeValue(value),
                },
            })),
            setEffectiveAt: (effectiveAt) => set({ effectiveAt: sanitizeEffectiveAt(effectiveAt) }),
            setAmbiguityPolicy: (policy) => set({ ambiguityPolicy: sanitizeAmbiguityPolicy(policy) }),
            setVectorWeight: (weight) =>
                set({ vectorWeight: weight, textWeight: 1 - weight }),

            setTextWeight: (weight) =>
                set({ textWeight: weight, vectorWeight: 1 - weight }),

            setMinScore: (score) => set({ minScore: score }),
            setSearchLimit: (limit) => set({ searchLimit: limit }),
            setTopK: (k) => set({ topK: k }),
            setMinRelevance: (relevance) => set({ minRelevance: relevance }),
            setGeneratorModel: (model) =>
                set({ generatorModel: sanitizeGeneratorModel(model) }),
            setAuditorModel: (model) => set({ auditorModel: model }),
            setTemperature: (temp) => set({ temperature: temp }),
            setEnableAuditor: (enabled) => set({ enableAuditor: enabled }),
            setConfidenceThreshold: (threshold) => set({ confidenceThreshold: threshold }),
            setEmptyChunkOcrEnabled: (enabled) => set({ emptyChunkOcrEnabled: enabled }),
            setEmptyChunkOcrEngine: (engine) => set({ emptyChunkOcrEngine: sanitizeOcrEngine(engine) }),
            setLastStats: (stats) => set({ lastStats: stats }),

            resetToDefaults: () => set(DEFAULT_SETTINGS),
        }),
        {
            name: 'wenkugpt-settings',
            version: 7,
            migrate: migratePersistedSettings,
        }
    )
);

/**
 * Get current settings for API use (non-reactive).
 */
export function getSettings(): Omit<SettingsState,
    'setRagEngine' | 'setContextScopeField' | 'setEffectiveAt' | 'setAmbiguityPolicy' |
    'setVectorWeight' | 'setTextWeight' | 'setMinScore' | 'setSearchLimit' |
    'setTopK' | 'setMinRelevance' | 'setGeneratorModel' | 'setAuditorModel' |
    'setTemperature' | 'setEnableAuditor' | 'setConfidenceThreshold' |
    'setEmptyChunkOcrEnabled' | 'setEmptyChunkOcrEngine' |
    'setLastStats' | 'resetToDefaults'
> {
    return useSettings.getState();
}
