'use client';

import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

interface SpotlightConfettiProps {
    open: boolean;
    onClose?: () => void;
    title?: string;
    subtitle?: string;
    durationMs?: number;
    autoClose?: boolean;
    blurPx?: number;
    dimOpacity?: number;
    holeRadius?: number;
    ringThickness?: number;
    glowSize?: number;
    zIndex?: number;
    particleCount?: number;
    gravity?: number;
    drag?: number;
    closeOnBackdrop?: boolean;
    closeOnEsc?: boolean;
    lockScroll?: boolean;
    children?: ReactNode;
}

interface ConfettiPiece {
    id: number;
    side: 'left' | 'right';
    offset: number;
    tx: number;
    ty: number;
    rot: number;
    delay: number;
    duration: number;
    color: string;
    width: number;
    height: number;
}

const CONFETTI_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de', '#ff2d55', '#5ac8fa'];

function ConfettiBurst({
    particleCount,
    gravity,
    drag,
    zIndex,
}: {
    particleCount: number;
    gravity: number;
    drag: number;
    zIndex: number;
}) {
    const pseudoRandom = (seed: number): number => {
        const x = Math.sin(seed * 12.9898) * 43758.5453;
        return x - Math.floor(x);
    };

    const pieces = useMemo<ConfettiPiece[]>(
        () =>
            Array.from({ length: particleCount }, (_, id) => {
                const side: 'left' | 'right' = id % 2 === 0 ? 'left' : 'right';
                const r1 = pseudoRandom(id + 0.11);
                const r2 = pseudoRandom(id + 0.22);
                const r3 = pseudoRandom(id + 0.33);
                const r4 = pseudoRandom(id + 0.44);
                const r5 = pseudoRandom(id + 0.55);
                const r6 = pseudoRandom(id + 0.66);
                const r7 = pseudoRandom(id + 0.77);
                const r8 = pseudoRandom(id + 0.88);
                const gravityFactor = Math.max(0.45, Math.min(1.6, gravity / 1400));
                const dragFactor = Math.max(0.7, Math.min(1.25, drag));
                const speed = 0.8 + r1 * 0.8;
                return {
                    id,
                    side,
                    offset: 12 + r2 * 32,
                    tx: (side === 'left' ? 1 : -1) * (220 + r3 * 320),
                    ty: -(220 + r4 * 380) * gravityFactor,
                    rot: (r5 - 0.5) * 920,
                    delay: r6 * 180,
                    duration: (900 + speed * 900) / dragFactor,
                    color: CONFETTI_COLORS[id % CONFETTI_COLORS.length],
                    width: 5 + r7 * 6,
                    height: 9 + r8 * 9,
                };
            }),
        [drag, gravity, particleCount],
    );

    return (
        <div
            aria-hidden
            style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex,
                overflow: 'hidden',
            }}
        >
            {pieces.map((piece) => {
                const style = {
                    '--confetti-tx': `${piece.tx}px`,
                    '--confetti-ty': `${piece.ty}px`,
                    '--confetti-rot': `${piece.rot}deg`,
                    position: 'absolute',
                    bottom: `${piece.offset}%`,
                    left: piece.side === 'left' ? '14%' : '86%',
                    width: `${piece.width}px`,
                    height: `${piece.height}px`,
                    background: piece.color,
                    borderRadius: '2px',
                    opacity: 0,
                    transform: 'translate3d(0, 0, 0) rotate(0deg)',
                    animation: `confettiFall ${piece.duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${piece.delay}ms forwards, confettiSpin ${Math.max(500, piece.duration * 0.7)}ms linear ${piece.delay}ms infinite`,
                } as CSSProperties & Record<'--confetti-tx' | '--confetti-ty' | '--confetti-rot', string>;

                return <span key={piece.id} style={style} />;
            })}
        </div>
    );
}

export default function SpotlightConfetti({
    open,
    onClose,
    title = 'Reward unlocked!',
    subtitle = 'You got a new item',
    durationMs = 1800,
    autoClose = true,
    blurPx = 10,
    dimOpacity = 0.72,
    holeRadius = 150,
    ringThickness = 10,
    glowSize = 60,
    zIndex = 9999,
    particleCount = 220,
    gravity = 1400,
    drag = 0.985,
    closeOnBackdrop = true,
    closeOnEsc = true,
    lockScroll = true,
    children,
}: SpotlightConfettiProps) {
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [reduceMotion, setReduceMotion] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    useEffect(() => {
        if (!lockScroll || typeof document === 'undefined') return undefined;
        const previousOverflow = document.body.style.overflow;
        if (open) document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [open, lockScroll]);

    useEffect(() => {
        if (!open || !closeOnEsc) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, closeOnEsc, onClose]);

    useEffect(() => {
        if (!open || !autoClose) return undefined;
        const timeout = window.setTimeout(() => onClose?.(), durationMs);
        return () => window.clearTimeout(timeout);
    }, [open, autoClose, durationMs, onClose]);

    if (!open) return null;

    const reducedParticleCount = reduceMotion ? Math.min(32, particleCount) : particleCount;

    return (
        <div
            ref={overlayRef}
            aria-modal="true"
            role="dialog"
            onMouseDown={(event) => {
                if (!closeOnBackdrop) return;
                if (event.target === overlayRef.current) onClose?.();
            }}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex,
                display: 'grid',
                placeItems: 'center',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    backdropFilter: `blur(${blurPx}px)`,
                    WebkitBackdropFilter: `blur(${blurPx}px)`,
                }}
            />

            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle ${holeRadius}px at 50% 50%, transparent 0 ${Math.max(
                        0,
                        holeRadius - 1,
                    )}px, rgba(0,0,0,${dimOpacity}) ${holeRadius}px 100%)`,
                    zIndex: zIndex + 1,
                }}
            />

            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: `${(holeRadius + glowSize) * 2}px`,
                    height: `${(holeRadius + glowSize) * 2}px`,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '999px',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.10) 52%, rgba(255,255,255,0) 100%)',
                    zIndex: zIndex + 1,
                }}
            />

            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: `${(holeRadius + ringThickness * 0.6) * 2}px`,
                    height: `${(holeRadius + ringThickness * 0.6) * 2}px`,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '999px',
                    border: `${Math.max(2, ringThickness)}px solid rgba(255,255,255,0.55)`,
                    zIndex: zIndex + 1,
                }}
            />

            {!reduceMotion && (
                <ConfettiBurst
                    particleCount={reducedParticleCount}
                    gravity={gravity}
                    drag={drag}
                    zIndex={zIndex + 2}
                />
            )}

            <div
                style={{
                    position: 'relative',
                    zIndex: zIndex + 3,
                    width: 'min(560px, calc(100vw - 32px))',
                    textAlign: 'center',
                    pointerEvents: 'auto',
                }}
            >
                <div
                    style={{
                        width: holeRadius * 2,
                        height: holeRadius * 2,
                        margin: '0 auto 18px',
                        display: 'grid',
                        placeItems: 'center',
                        filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.45))',
                        transform: 'translateZ(0)',
                        animation: reduceMotion ? undefined : 'spotPop 420ms ease-out',
                    }}
                >
                    {children}
                </div>

                <div
                    style={{
                        padding: '14px 16px',
                        borderRadius: 18,
                        background: 'rgba(20, 20, 24, 0.55)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        boxShadow: '0 18px 60px rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                    }}
                >
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.96)' }}>
                        {title}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,0.75)' }}>
                        {subtitle}
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                        <button
                            type="button"
                            onClick={() => onClose?.()}
                            style={{
                                padding: '10px 14px',
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.18)',
                                background: 'rgba(255,255,255,0.10)',
                                color: 'rgba(255,255,255,0.92)',
                                cursor: 'pointer',
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spotPop {
                    0% { transform: scale(0.92); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }

                @keyframes confettiFall {
                    0% {
                        opacity: 1;
                        transform: translate3d(0, 0, 0) rotate(0deg);
                    }
                    100% {
                        opacity: 0;
                        transform: translate3d(var(--confetti-tx), var(--confetti-ty), 0) rotate(var(--confetti-rot));
                    }
                }

                @keyframes confettiSpin {
                    from { filter: saturate(1); }
                    to { filter: saturate(1.2); }
                }
            `}</style>
        </div>
    );
}
