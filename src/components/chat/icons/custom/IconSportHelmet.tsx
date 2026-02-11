import type { CustomSuggestionIconProps } from './types';

export function IconSportHelmet(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M4 13.1A8 8 0 0 1 12 5.1A8 8 0 0 1 20 13.1V14.8H4V13.1Z" />
                <path d="M10.2 14.8V17.4H7.6M15.8 9.8H18.2" />
            </g>
        </svg>
    );
}

