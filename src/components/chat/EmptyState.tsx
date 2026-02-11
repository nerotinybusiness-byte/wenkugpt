'use client';

import { Code2, Lightbulb, LayoutTemplate, SlidersHorizontal } from 'lucide-react';
import { useMemo } from 'react';
import {
    CHAT_SUGGESTION_POOL,
    EMPTY_STATE_SUGGESTION_COUNT,
    pickRandomSuggestions,
    type SuggestionIconKey,
    type SuggestionPoolItem,
} from './suggestionPool';

interface EmptyStateProps {
    onSuggestionSelect?: (prompt: string) => void;
}

export default function EmptyState({ onSuggestionSelect }: EmptyStateProps) {
    const suggestions = useMemo<SuggestionPoolItem[]>(
        () => pickRandomSuggestions(CHAT_SUGGESTION_POOL, EMPTY_STATE_SUGGESTION_COUNT),
        [],
    );

    const iconMap: Record<SuggestionIconKey, typeof Lightbulb> = {
        idea: Lightbulb,
        code: Code2,
        css: SlidersHorizontal,
        layout: LayoutTemplate,
    };

    return (
        <div className="flex h-full flex-col items-center justify-center p-8">
            <div className="mb-10 flex flex-col items-center">
                <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl liquid-glass">
                    <svg
                        className="h-10 w-10"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        style={{ color: 'var(--c-action)' }}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                    </svg>
                </div>

                <h1 className="mb-2 text-4xl font-semibold text-[var(--c-content)]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                    Liquid Glass Chat
                </h1>
                <p className="text-center text-2xl text-[var(--c-content)]/50" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                    Start a conversation with AI
                </p>
            </div>

            <div className="grid w-full max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
                {suggestions.map((suggestion) => {
                    const SuggestionIcon = iconMap[suggestion.icon] ?? Lightbulb;

                    return (
                        <button
                            key={suggestion.title}
                            type="button"
                            onClick={() => onSuggestionSelect?.(suggestion.prompt)}
                            className="liquid-glass w-full rounded-[24px] p-5 text-left transition-colors duration-200 hover:text-[var(--c-action)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-action)]/60"
                        >
                            <div className="flex items-start gap-4">
                                <SuggestionIcon className="mt-0.5 h-6 w-6 text-[var(--c-action)]" strokeWidth={1.8} />
                                <div>
                                    <h3 className="mb-0.5 text-[15px] font-medium tracking-wide text-[var(--c-content)]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                                        {suggestion.title}
                                    </h3>
                                    <p className="text-[13px] text-[var(--c-content)]/55" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                                        {suggestion.subtitle}
                                    </p>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
