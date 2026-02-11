import type { CustomSuggestionIconProps } from './types';

export function IconSportPaddle(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M8.5 4.3H15a2.1 2.1 0 0 1 2.1 2.1V15a2.1 2.1 0 0 1-2.1 2.1H8.5A2.1 2.1 0 0 1 6.4 15V6.4a2.1 2.1 0 0 1 2.1-2.1Z" />
                <path d="M10.6 17.1V20.2M13.4 17.1V20.2M9.8 20.2H14.2" />
            </g>
        </svg>
    );
}

