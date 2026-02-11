import type { CustomSuggestionIconProps } from './types';

export function IconSportFootball(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="8.8" />
                <path d="M12 8.8L13.9 10.2L13.2 12.4H10.8L10.1 10.2L12 8.8Z" />
                <path d="M12 3.2V5.3M20.8 12H18.7M5.3 12H3.2M16.8 7.2L15.4 8.5M8.6 8.5L7.2 7.2M16.8 16.8L15.4 15.5M8.6 15.5L7.2 16.8" />
            </g>
        </svg>
    );
}

