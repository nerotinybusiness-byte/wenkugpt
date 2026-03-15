import type { CustomSuggestionIconProps } from './types';

export function IconLifestyleWine(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M8.2 4.8H15.8V10.1A3.8 3.8 0 0 1 12 13.9A3.8 3.8 0 0 1 8.2 10.1V4.8Z" />
                <path d="M8.3 8.8C9.4 8.2 10.7 8.3 12 8.8C13.3 9.3 14.6 9.4 15.7 8.8" />
                <path d="M12 13.9V18.4M9.2 18.4H14.8" />
            </g>
        </svg>
    );
}

