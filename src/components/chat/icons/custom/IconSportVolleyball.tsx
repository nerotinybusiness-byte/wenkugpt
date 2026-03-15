import type { CustomSuggestionIconProps } from './types';

export function IconSportVolleyball(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="8.8" />
                <path d="M6.8 6.8C8.8 8 10.2 10 10.6 12.4" />
                <path d="M16.9 6.6C15.4 8 14.5 9.9 14.3 12.1" />
                <path d="M6 13.1C8.4 12.6 10.8 13.2 12.7 14.8" />
                <path d="M12.8 4.2C13.2 6.5 14.6 8.6 16.7 9.9" />
                <path d="M9.1 18.8C10.7 17.2 13 16.4 15.2 16.5" />
            </g>
        </svg>
    );
}
