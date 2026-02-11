import type { CustomSuggestionIconProps } from './types';

export function IconSportTennisRacket(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <ellipse cx="10.1" cy="9.4" rx="4.6" ry="6" transform="rotate(-24 10.1 9.4)" />
                <path d="M12.8 13.5L17.5 18.2" />
                <path d="M16.3 17L18.8 19.5" />
                <circle cx="18.6" cy="7.1" r="1.8" />
                <path d="M8.1 6.7L11 12.2M6.8 9L10.8 13.2" />
            </g>
        </svg>
    );
}

