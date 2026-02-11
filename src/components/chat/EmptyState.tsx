import { MessageSquare, Sparkles, Search, FileText, Phone } from 'lucide-react';

interface EmptyStateProps {
    onSuggestionSelect?: (prompt: string) => void;
}

interface SuggestionItem {
    icon: typeof Sparkles;
    title: string;
    subtitle: string;
    prompt: string;
}

export default function EmptyState({ onSuggestionSelect }: EmptyStateProps) {
    const suggestions: SuggestionItem[] = [
        {
            icon: Sparkles,
            title: 'Shrn hlavni body',
            subtitle: 'Rychly prehled z nahranych dokumentu',
            prompt: 'Shrn prosim hlavni body z mych nahranych dokumentu do 5 strucnych odrazek.',
        },
        {
            icon: Search,
            title: 'Najdi konkretni info',
            subtitle: 'Vyhledani jmena, terminu nebo casti textu',
            prompt: 'Najdi v dokumentech vsechny zminky o kontaktu Jiri Zabilansky a uved zdroj.',
        },
        {
            icon: Phone,
            title: 'Vypis kontakty',
            subtitle: 'Jmena a telefonni cisla presne podle dokumentu',
            prompt: 'Vypis vsechny osoby a telefonni cisla presne tak, jak jsou uvedene v dokumentech.',
        },
        {
            icon: FileText,
            title: 'Porovnej dokumenty',
            subtitle: 'Co se mezi verzemi zmenilo',
            prompt: 'Porovnej hlavni rozdily mezi nahranymi dokumenty a napis, co se zmenilo.',
        },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full p-8">
            <div className="relative mb-12">
                <div className="relative w-24 h-24 rounded-[32px] flex items-center justify-center mb-8 mx-auto shadow-2xl ring-1 ring-white/10 bg-white/5 backdrop-blur-3xl">
                    <MessageSquare className="w-10 h-10 text-[var(--c-content)]/80" strokeWidth={1.1} />
                </div>

                <h2 className="text-4xl font-medium text-center tracking-tight text-[var(--c-content)] mb-3" style={{ fontFamily: 'var(--font-ui)' }}>
                    WenkuGPT
                </h2>
                <p className="text-[var(--c-content)]/55 text-center text-lg font-light tracking-wide">
                    Zacni konverzaci jednim kliknutim.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl w-full">
                {suggestions.map((suggestion) => (
                    <button
                        key={suggestion.title}
                        type="button"
                        onClick={() => onSuggestionSelect?.(suggestion.prompt)}
                        className="liquid-glass w-full rounded-[24px] p-5 text-center transition-colors duration-200 hover:text-[var(--c-action)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-action)]/60"
                    >
                        <div className="flex flex-col items-center gap-3">
                            <suggestion.icon className="w-6 h-6 text-[var(--c-action)]" strokeWidth={1.6} />
                            <div>
                                <h3 className="font-medium text-[15px] text-[var(--c-content)] tracking-wide mb-0.5" style={{ fontFamily: 'var(--font-ui)' }}>
                                    {suggestion.title}
                                </h3>
                                <p className="text-[13px] text-[var(--c-content)]/55 font-light">
                                    {suggestion.subtitle}
                                </p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
