declare module '@tinymomentum/liquid-glass-react' {
    import { FC, HTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

    export interface LiquidGlassContainerProps extends HTMLAttributes<HTMLDivElement> {
        variant?: 'glass' | 'glass-light' | 'glass-heavy';
        blur?: string;
        children?: ReactNode;
    }

    export interface LiquidGlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
        variant?: 'primary' | 'ghost' | 'glass';
        children?: ReactNode;
    }

    export interface LiquidGlassLinkProps extends HTMLAttributes<HTMLAnchorElement> {
        href?: string;
        children?: ReactNode;
    }

    export const LiquidGlassContainer: FC<LiquidGlassContainerProps>;
    export const LiquidGlassButton: FC<LiquidGlassButtonProps>;
    export const LiquidGlassLink: FC<LiquidGlassLinkProps>;
}
