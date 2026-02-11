import type { CustomSuggestionIconProps } from './types';

export function IconSportRope(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M4.2 12A3.8 3.8 0 0 1 8 8.2A3.8 3.8 0 0 1 11.8 12A3.8 3.8 0 0 1 8 15.8A3.8 3.8 0 0 1 4.2 12Z" />
                <path d="M10.2 12A3.8 3.8 0 0 1 14 8.2A3.8 3.8 0 0 1 17.8 12A3.8 3.8 0 0 1 14 15.8" />
                <path d="M17.4 8.6L20.5 5.5M17.4 15.4L20.5 18.5" />
            </g>
        </svg>
    );
}

