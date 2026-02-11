import { IconBrandWenkuW } from './IconBrandWenkuW';
import { IconBrandWenkuWaveCircle } from './IconBrandWenkuWaveCircle';
import { IconContextClipboard } from './IconContextClipboard';
import { IconContextPhone } from './IconContextPhone';
import { IconContextWhistle } from './IconContextWhistle';
import { IconGenericDocument } from './IconGenericDocument';
import { IconSportCone } from './IconSportCone';
import { IconSportFootball } from './IconSportFootball';
import { IconSportHelmet } from './IconSportHelmet';
import { IconSportPaddle } from './IconSportPaddle';
import { IconSportRope } from './IconSportRope';
import { IconSportVolleyball } from './IconSportVolleyball';
import type { CustomSuggestionIconComponent, CustomSuggestionIconId } from './types';

export const CUSTOM_SUGGESTION_ICON_REGISTRY: Record<CustomSuggestionIconId, CustomSuggestionIconComponent> = {
    sport_football: IconSportFootball,
    sport_volleyball: IconSportVolleyball,
    sport_paddle: IconSportPaddle,
    sport_cone: IconSportCone,
    sport_helmet: IconSportHelmet,
    sport_rope: IconSportRope,
    context_phone: IconContextPhone,
    context_clipboard: IconContextClipboard,
    context_whistle: IconContextWhistle,
    brand_wenku_w: IconBrandWenkuW,
    brand_wenku_wave_circle: IconBrandWenkuWaveCircle,
    generic_document: IconGenericDocument,
};

export function getCustomSuggestionIcon(iconId: CustomSuggestionIconId): CustomSuggestionIconComponent {
    return CUSTOM_SUGGESTION_ICON_REGISTRY[iconId] ?? CUSTOM_SUGGESTION_ICON_REGISTRY.generic_document;
}

