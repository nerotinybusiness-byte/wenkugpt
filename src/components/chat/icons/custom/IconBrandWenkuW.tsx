import type { CustomSuggestionIconProps } from './types';

export function IconBrandWenkuW(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="8.8" />
                <path d="M7.1 8.2L8.7 15.8L12 9.4L15.3 15.8L16.9 8.2" />
            </g>
        </svg>
    );
}

