import type { ComponentType, SVGProps } from 'react';

export type CustomSuggestionIconId =
    | 'sport_football'
    | 'sport_volleyball'
    | 'sport_paddle'
    | 'sport_cone'
    | 'sport_helmet'
    | 'sport_rope'
    | 'context_phone'
    | 'context_clipboard'
    | 'context_whistle'
    | 'brand_wenku_w'
    | 'brand_wenku_wave_circle'
    | 'generic_document';

export type CustomSuggestionIconProps = SVGProps<SVGSVGElement>;

export type CustomSuggestionIconComponent = ComponentType<CustomSuggestionIconProps>;

