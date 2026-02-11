import type { CustomSuggestionIconProps } from './types';

export function IconBrandWenkuWaveCircle(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="8.8" />
                <path d="M5.8 12H8.1L9.6 8.8L11.4 15.8L13 10.2L14.5 13.2L16 12H18.2" />
            </g>
        </svg>
    );
}
