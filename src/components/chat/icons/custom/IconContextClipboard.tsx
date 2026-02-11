import type { CustomSuggestionIconProps } from './types';

export function IconContextClipboard(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M8.4 4.8H15.6A2.3 2.3 0 0 1 17.9 7.1V18.4A2.3 2.3 0 0 1 15.6 20.7H8.4A2.3 2.3 0 0 1 6.1 18.4V7.1A2.3 2.3 0 0 1 8.4 4.8Z" />
                <path d="M9.4 4.8A2.6 2.6 0 0 1 12 3.3A2.6 2.6 0 0 1 14.6 4.8V6.1H9.4V4.8Z" />
                <path d="M9.2 10.2H14.8M9.2 13.3H14.8M9.2 16.4H12.9" />
            </g>
        </svg>
    );
}

