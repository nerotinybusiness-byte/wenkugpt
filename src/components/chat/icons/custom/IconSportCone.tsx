import type { CustomSuggestionIconProps } from './types';

export function IconSportCone(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M12 4L19 19H5L12 4Z" />
                <path d="M8.8 11.8H15.2M7.4 15.4H16.6" />
            </g>
        </svg>
    );
}

