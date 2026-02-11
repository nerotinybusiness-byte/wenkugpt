import type { CustomSuggestionIconProps } from './types';

export function IconSportTennisBall(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="8.8" />
                <path d="M8.2 5.2C10.2 7.4 10.2 10.1 8.2 12.3C6.2 14.5 6.2 17.2 8.2 19.4" />
                <path d="M15.8 4.6C13.8 6.8 13.8 9.5 15.8 11.7C17.8 13.9 17.8 16.6 15.8 18.8" />
            </g>
        </svg>
    );
}

