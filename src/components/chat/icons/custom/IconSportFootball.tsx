import type { CustomSuggestionIconProps } from './types';

export function IconSportFootball(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="8.8" />
                <path d="M12 7L14.3 8.5L13.5 11H10.5L9.7 8.5L12 7Z" />
                <path d="M9.7 8.5L7 9.6L7.7 12.7L10.5 11M14.3 8.5L17 9.6L16.3 12.7L13.5 11" />
                <path d="M7.7 12.7L9.8 15L12 14.2L14.2 15L16.3 12.7" />
            </g>
        </svg>
    );
}
