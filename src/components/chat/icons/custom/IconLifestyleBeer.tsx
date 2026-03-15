import type { CustomSuggestionIconProps } from './types';

export function IconLifestyleBeer(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M10.3 4.2H13.7V6.2L15.3 8V18.6A1.7 1.7 0 0 1 13.6 20.3H10.4A1.7 1.7 0 0 1 8.7 18.6V8L10.3 6.2V4.2Z" />
                <path d="M10.3 6.2H13.7M10.4 11H13.6V14.4H10.4V11Z" />
                <circle cx="15.9" cy="11.1" r="1" />
            </g>
        </svg>
    );
}

