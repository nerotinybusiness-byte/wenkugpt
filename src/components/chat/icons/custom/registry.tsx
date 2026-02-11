import { IconApparelHoodieW } from './IconApparelHoodieW';
import { IconApparelTshirtW } from './IconApparelTshirtW';
import { IconBrandWenkuW } from './IconBrandWenkuW';
import { IconBrandWenkuWaveCircle } from './IconBrandWenkuWaveCircle';
import { IconContextClipboard } from './IconContextClipboard';
import { IconContextPhone } from './IconContextPhone';
import { IconContextWhistle } from './IconContextWhistle';
import { IconGenericDocument } from './IconGenericDocument';
import { IconLifestyleBeer } from './IconLifestyleBeer';
import { IconLifestyleWine } from './IconLifestyleWine';
import { IconSportBaseballBat } from './IconSportBaseballBat';
import { IconSportCone } from './IconSportCone';
import { IconSportFootball } from './IconSportFootball';
import { IconSportTennisBall } from './IconSportTennisBall';
import { IconSportTennisRacket } from './IconSportTennisRacket';
import { IconSportVolleyball } from './IconSportVolleyball';
import type { CustomSuggestionIconComponent, CustomSuggestionIconId } from './types';

export const CUSTOM_SUGGESTION_ICON_REGISTRY: Record<CustomSuggestionIconId, CustomSuggestionIconComponent> = {
    sport_football: IconSportFootball,
    sport_volleyball: IconSportVolleyball,
    sport_tennis_ball: IconSportTennisBall,
    sport_tennis_racket: IconSportTennisRacket,
    sport_cone: IconSportCone,
    sport_baseball_bat: IconSportBaseballBat,
    apparel_hoodie_w: IconApparelHoodieW,
    apparel_tshirt_w: IconApparelTshirtW,
    lifestyle_wine: IconLifestyleWine,
    lifestyle_beer: IconLifestyleBeer,
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
