import type { CustomSuggestionIconProps } from './types';

export function IconContextWhistle(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M5.5 11.2V15A3.8 3.8 0 0 0 9.3 18.8H11.2A3.8 3.8 0 0 0 15 15V12.8A3.3 3.3 0 0 0 11.7 9.5H9L15 5L17.2 7.2L12.8 10.6" />
                <circle cx="17.6" cy="13.7" r="1.6" />
            </g>
        </svg>
    );
}

