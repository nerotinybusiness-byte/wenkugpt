import type { CustomSuggestionIconProps } from './types';

export function IconGenericDocument(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M8 3.7H13.6L18 8.1V18.5A1.8 1.8 0 0 1 16.2 20.3H8A1.8 1.8 0 0 1 6.2 18.5V5.5A1.8 1.8 0 0 1 8 3.7Z" />
                <path d="M13.6 3.7V8.1H18M9.5 11.6H14.5M9.5 14.7H14.5M9.5 17.8H12.7" />
            </g>
        </svg>
    );
}

