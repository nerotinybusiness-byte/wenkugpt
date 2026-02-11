import type { CustomSuggestionIconProps } from './types';

export function IconBrandWenkuWaveCircle(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="8.8" />
                <path d="M5.8 12H8.2L10 8.3L12 16.2L14 9.7L15.7 12H18.2" />
            </g>
        </svg>
    );
}

