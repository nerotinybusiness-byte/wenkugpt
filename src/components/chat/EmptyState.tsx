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
            title: 'Shrň hlavní body',
            subtitle: 'Rychlý přehled z nahraných dokumentů',
            prompt: 'Shrň prosím hlavní body z mých nahraných dokumentů do 5 stručných odrážek.',
        },
        {
            icon: Search,
            title: 'Najdi konkrétní info',
            subtitle: 'Vyhledání jména, termínu nebo části textu',
            prompt: 'Najdi v dokumentech všechny zmínky o kontaktu Jiří Zabilanský a uveď zdroj.',
        },
        {
            icon: Phone,
            title: 'Vypiš kontakty',
            subtitle: 'Jména + telefonní čísla přesně podle dokumentu',
            prompt: 'Vypiš všechny osoby a telefonní čísla přesně tak, jak jsou uvedené v dokumentech.',
        },
        {
            icon: FileText,
            title: 'Porovnej dokumenty',
            subtitle: 'Co se mezi verzemi změnilo',
            prompt: 'Porovnej hlavní rozdíly mezi nahranými dokumenty a napiš, co se změnilo.',
        },
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 md:p-8 animate-in fade-in zoom-in duration-700">
            <div className="relative mb-8 md:mb-10 group">
                <div className="absolute inset-0 bg-[var(--c-action)]/10 blur-[70px] rounded-full group-hover:bg-[var(--c-action)]/20 transition-colors duration-1000" />

                <div className="relative w-20 h-20 rounded-[24px] flex items-center justify-center mb-6 mx-auto shadow-2xl ring-1 ring-white/10 bg-white/5 backdrop-blur-3xl">
                    <MessageSquare className="w-9 h-9 text-[var(--c-content)]/80" strokeWidth={1.2} />
                </div>

                <h2 className="text-3xl md:text-4xl font-medium text-center tracking-tight text-[var(--c-content)] mb-2" style={{ fontFamily: 'var(--font-ui)' }}>
                    WenkuGPT
                </h2>
                <p className="text-[var(--c-content)]/55 text-center text-base md:text-lg font-light tracking-wide">
                    Začni konverzaci jedním kliknutím.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-3xl w-full">
                {suggestions.map((suggestion) => (
                    <button
                        key={suggestion.title}
                        type="button"
                        onClick={() => onSuggestionSelect?.(suggestion.prompt)}
                        className="p-4 md:p-5 rounded-2xl text-left active:scale-[0.99] cursor-pointer transition-all duration-300 group border border-black/10 dark:border-white/10 hover:border-[var(--c-action)]/40 bg-black/[0.03] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--c-action)]/10 text-[var(--c-action)] shrink-0 mt-0.5">
                                <suggestion.icon className="w-5 h-5" strokeWidth={1.8} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-[15px] text-[var(--c-content)] tracking-wide mb-0.5">
                                    {suggestion.title}
                                </h3>
                                <p className="text-[13px] text-[var(--c-content)]/60 font-light">
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
