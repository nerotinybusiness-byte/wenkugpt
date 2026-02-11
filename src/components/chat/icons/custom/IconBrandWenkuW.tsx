import type { CustomSuggestionIconProps } from './types';

export function IconBrandWenkuW(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="8.8" />
                <path d="M6.9 8.4L8.8 15.6L12 10L15.2 15.6L17.1 8.4" />
                <path d="M8.8 15.6H15.2" />
            </g>
        </svg>
    );
}
