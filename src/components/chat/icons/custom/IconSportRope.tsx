import type { CustomSuggestionIconProps } from './types';

export function IconSportRope(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M4.2 13.1C4.2 10.5 6.3 8.4 8.9 8.4C11.5 8.4 13.6 10.5 13.6 13.1C13.6 15.7 11.5 17.8 8.9 17.8C6.3 17.8 4.2 15.7 4.2 13.1Z" />
                <path d="M10.4 12.3C10.4 10.1 12.2 8.3 14.4 8.3C16.6 8.3 18.4 10.1 18.4 12.3C18.4 14.5 16.6 16.3 14.4 16.3" />
                <path d="M18.1 9.2L20.3 7M18.2 15.2L20.4 17.4" />
            </g>
        </svg>
    );
}
