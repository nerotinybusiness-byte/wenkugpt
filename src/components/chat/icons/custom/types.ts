import type { ComponentType, SVGProps } from 'react';

export type CustomSuggestionIconId =
    | 'sport_football'
    | 'sport_volleyball'
    | 'sport_tennis_ball'
    | 'sport_tennis_racket'
    | 'sport_cone'
    | 'sport_baseball_bat'
    | 'sport_rope'
    | 'apparel_hoodie_w'
    | 'apparel_tshirt_w'
    | 'lifestyle_wine'
    | 'lifestyle_beer'
    | 'context_phone'
    | 'context_clipboard'
    | 'context_whistle'
    | 'brand_wenku_w'
    | 'brand_wenku_wave_circle'
    | 'generic_document';

export type CustomSuggestionIconProps = SVGProps<SVGSVGElement>;

export type CustomSuggestionIconComponent = ComponentType<CustomSuggestionIconProps>;
