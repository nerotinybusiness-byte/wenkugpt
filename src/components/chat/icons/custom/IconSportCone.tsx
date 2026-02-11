import type { CustomSuggestionIconProps } from './types';

export function IconSportCone(props: CustomSuggestionIconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" {...props}>
            <g strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}>
                <path d="M12 4L18.1 18.1H5.9L12 4Z" />
                <path d="M8.9 10.3H15.1M7.6 14H16.4" />
                <rect x="4.3" y="18.1" width="15.4" height="2.4" rx="1.2" />
            </g>
        </svg>
    );
}
