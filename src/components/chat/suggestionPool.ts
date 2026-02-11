import type { CustomSuggestionIconId } from './icons/custom/types';

export interface SuggestionPoolItem {
    icon: CustomSuggestionIconId;
    title: string;
    subtitle: string;
    prompt: string;
}

export const EMPTY_STATE_SUGGESTION_COUNT = 4;

// Add/edit suggestions here. EmptyState will always render 4 random items from this pool.
export const CHAT_SUGGESTION_POOL: SuggestionPoolItem[] = [
    {
        icon: 'brand_wenku_wave_circle',
        title: 'Shrn hlavni body Wenku',
        subtitle: 'Rychly prehled z nahranych dokumentu',
        prompt: 'Shrn hlavni body z dokumentu Wenku do 5 strucnych odrazek.',
    },
    {
        icon: 'brand_wenku_w',
        title: 'Najdi dulezite informace',
        subtitle: 'Klicova data a terminy na jednom miste',
        prompt: 'Najdi v dokumentech vsechny dulezite terminy, data a odpovedne osoby.',
    },
    {
        icon: 'context_phone',
        title: 'Vypis kontakty',
        subtitle: 'Jmena + telefonni cisla presne podle textu',
        prompt: 'Vypis vsechny osoby a telefonni cisla presne tak, jak jsou uvedene v dokumentech.',
    },
    {
        icon: 'context_clipboard',
        title: 'Udelej checklist',
        subtitle: 'Task list z dokumentu behem chvilky',
        prompt: 'Vytvor prakticky checklist ukolu podle nahranych dokumentu.',
    },
    {
        icon: 'context_whistle',
        title: 'Briefing pro tym',
        subtitle: 'Strucny plan a role pro vedouci',
        prompt: 'Priprav kratky briefing pro vedouci tymu podle nahranych dokumentu.',
    },
    {
        icon: 'generic_document',
        title: 'Porovnej dokumenty',
        subtitle: 'Co se mezi verzemi zmenilo',
        prompt: 'Porovnej hlavni rozdily mezi dokumenty a vypis zmeny.',
    },
    {
        icon: 'sport_football',
        title: 'Fotbalova aktivita',
        subtitle: 'Napad na bezpecny trening v terenu',
        prompt: 'Navrhni fotbalovou aktivitu pro deti vcetne casove osy a bezpecnostnich pravidel.',
    },
    {
        icon: 'sport_volleyball',
        title: 'Volejbalova aktivita',
        subtitle: 'Jednoduchy plan cviceni pro skupinu',
        prompt: 'Navrhni volejbalovou aktivitu pro skupinu s jasnymi kroky a pravidly.',
    },
    {
        icon: 'sport_tennis_ball',
        title: 'Tenisovy mic - mini hry',
        subtitle: 'Rychle warmup hry s mickem',
        prompt: 'Navrhni 3 kratke warmup hry s tenisovym mickem pro skupinu deti.',
    },
    {
        icon: 'sport_tennis_racket',
        title: 'Tenisova raketa trening',
        subtitle: 'Zakladni drill plan po blocich',
        prompt: 'Sestav zakladni treninkovy blok s tenisovou raketou na 30 minut.',
    },
    {
        icon: 'sport_cone',
        title: 'Kuzely a drahy',
        subtitle: 'Rozestaveni trasy a orientacni body',
        prompt: 'Priprav navrh drahy s kuzely vcetne popisu rozestaveni.',
    },
    {
        icon: 'sport_baseball_bat',
        title: 'Koordinace s palkou',
        subtitle: 'Dynamicky blok na pohyb a reakce',
        prompt: 'Navrhni koordinacni cviceni s palkou se zamerenim na reakci a bezpecnost.',
    },
    {
        icon: 'sport_cone',
        title: 'Lano a uzly',
        subtitle: 'Postup pro kontrolu vybaveni',
        prompt: 'Vytvor postup kontroly vybaveni a zakladnich uzlu pred aktivitou.',
    },
    {
        icon: 'apparel_hoodie_w',
        title: 'Mikiny Wenku',
        subtitle: 'Prehled objednavek a velikosti',
        prompt: 'Priprav prehled velikosti a poctu mikin podle dat v dokumentech.',
    },
    {
        icon: 'apparel_tshirt_w',
        title: 'Trika Wenku',
        subtitle: 'Distribuce a stav skladu',
        prompt: 'Vypis navrh distribuce tricek podle skupin a velikosti.',
    },
    {
        icon: 'lifestyle_wine',
        title: 'Vecerni servis - vino',
        subtitle: 'Klidny plan servisu a logistiky',
        prompt: 'Navrhni jednoduchy plan vecerniho servisu vina pro interni akci.',
    },
    {
        icon: 'lifestyle_beer',
        title: 'Obcerstveni - pivo',
        subtitle: 'Plan zasob a doplnovani',
        prompt: 'Navrhni plan zasob a doplnovani piva pro event.',
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
