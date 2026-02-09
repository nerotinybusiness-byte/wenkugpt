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
    setLastStats: (stats: SettingsState['lastStats']) => void;
    resetToDefaults: () => void;
}

/**
 * Default settings values.
 */
const DEFAULT_SETTINGS = {
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

/**
 * Settings store with persistence.
 */
export const useSettings = create<SettingsState>()(
    persist(
        (set) => ({
            ...DEFAULT_SETTINGS,

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
            setLastStats: (stats) => set({ lastStats: stats }),

            resetToDefaults: () => set(DEFAULT_SETTINGS),
        }),
        {
            name: 'wenkugpt-settings',
            version: 3,
            migrate: (persistedState: unknown, version: number) => {
                if (version === 1) {
                    return DEFAULT_SETTINGS;
                }

                if (!isPersistedSettingsState(persistedState)) {
                    return DEFAULT_SETTINGS;
                }

                const merged = { ...DEFAULT_SETTINGS, ...persistedState };
                return {
                    ...merged,
                    generatorModel: sanitizeGeneratorModel(merged.generatorModel),
                };
            },
        }
    )
);

/**
 * Get current settings for API use (non-reactive).
 */
export function getSettings(): Omit<SettingsState,
    'setVectorWeight' | 'setTextWeight' | 'setMinScore' | 'setSearchLimit' |
    'setTopK' | 'setMinRelevance' | 'setGeneratorModel' | 'setAuditorModel' |
    'setTemperature' | 'setEnableAuditor' | 'setConfidenceThreshold' |
    'setLastStats' | 'resetToDefaults'
> {
    return useSettings.getState();
}
