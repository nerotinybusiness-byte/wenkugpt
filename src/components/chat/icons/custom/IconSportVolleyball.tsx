import type { CustomSuggestionIconProps } from './types';

export function IconSportVolleyball(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="8.8" />
                <path d="M7.3 5.8C9.8 6.8 12.5 9.5 13.5 12.1" />
                <path d="M16.8 6.6C15.8 9.2 13.3 11.7 10.7 12.7" />
                <path d="M18.2 15.1C15.5 14 12.7 14.2 10.2 15.8" />
                <path d="M6.1 14.8C8.1 15.8 9.9 17.6 10.9 19.6" />
            </g>
        </svg>
    );
}

