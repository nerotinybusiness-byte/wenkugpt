export type SuggestionIconKey = 'idea' | 'code' | 'css' | 'layout';

export interface SuggestionPoolItem {
    icon: SuggestionIconKey;
    title: string;
    subtitle: string;
    prompt: string;
}

export const EMPTY_STATE_SUGGESTION_COUNT = 4;

// Add/edit suggestions here. EmptyState will always render 4 random items from this pool.
export const CHAT_SUGGESTION_POOL: SuggestionPoolItem[] = [
    {
        icon: 'idea',
        title: 'Explain the liquid glass effect',
        subtitle: "Learn about Apple's design language",
        prompt: 'Explain the liquid glass effect and when to use it in modern UI.',
    },
    {
        icon: 'code',
        title: 'Best practices for LLM UI',
        subtitle: 'Discover interface design principles',
        prompt: 'What are the best practices for building high-quality LLM chat interfaces?',
    },
    {
        icon: 'css',
        title: 'CSS backdrop-filter effects',
        subtitle: 'Master modern blur techniques',
        prompt: 'Show practical CSS backdrop-filter patterns for liquid glass UI.',
    },
    {
        icon: 'layout',
        title: 'Responsive design patterns',
        subtitle: 'Build adaptive interfaces',
        prompt: 'Give me responsive design patterns for desktop and mobile chat layouts.',
    },
    {
        icon: 'idea',
        title: 'Write better prompts',
        subtitle: 'Get clearer and more accurate answers',
        prompt: 'Show me a practical template for writing better prompts for document QA.',
    },
    {
        icon: 'code',
        title: 'RAG architecture checklist',
        subtitle: 'Core pieces to keep stable in production',
        prompt: 'Give me a production-ready RAG architecture checklist with monitoring points.',
    },
    {
        icon: 'css',
        title: 'Accessible color contrast',
        subtitle: 'Improve readability in light and dark modes',
        prompt: 'How should I validate and improve color contrast for a glassmorphism UI?',
    },
    {
        icon: 'layout',
        title: 'Mobile-first chat UX',
        subtitle: 'Keep the interface usable on small screens',
        prompt: 'Propose a mobile-first layout for chat + sources + file manager interactions.',
    },
];

export function pickRandomSuggestions(pool: SuggestionPoolItem[], count: number): SuggestionPoolItem[] {
    if (pool.length <= count) return pool;

    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
}

