'use client';

import { Sparkles } from 'lucide-react';
import { type ElementType, useEffect, useState } from 'react';

const ModelViewerTag = 'model-viewer' as unknown as ElementType;
const BEJROSKA_PRIMARY_MODEL_SRC = '/models/bejroska-hoodie-fast-png.glb?v=2026-02-12-png-1';
const BEJROSKA_FALLBACK_MODEL_SRC = '/models/bejroska-hoodie-draco-png.glb?v=2026-02-12-png-1';
const DRACO_DECODER_LOCATION = '/model-viewer/draco/';
const KTX2_TRANSCODER_LOCATION = '/model-viewer/basis/';
const MODEL_LOAD_TIMEOUT_MS = 20000;

type LoadPhase = 'booting' | 'loading' | 'ready' | 'error';
type ModelVariant = 'primary' | 'fallback';
type ErrorReason = 'import_failed' | 'primary_error' | 'fallback_error' | 'timeout';

const MODEL_SOURCE_BY_VARIANT: Record<ModelVariant, string> = {
    primary: BEJROSKA_PRIMARY_MODEL_SRC,
    fallback: BEJROSKA_FALLBACK_MODEL_SRC,
};

export default function BejroskaShowcase() {
    const [phase, setPhase] = useState<LoadPhase>(
        () => (typeof window !== 'undefined' && customElements.get('model-viewer') ? 'loading' : 'booting'),
    );
    const [errorReason, setErrorReason] = useState<ErrorReason | null>(null);
    const [activeVariant, setActiveVariant] = useState<ModelVariant>('primary');
    const [hasAttemptedFallback, setHasAttemptedFallback] = useState(false);
    const [hasVisibleProgress, setHasVisibleProgress] = useState(false);
    const [bootAttemptKey, setBootAttemptKey] = useState(0);
    const [viewerMountKey, setViewerMountKey] = useState(0);
    const activeModelSrc = MODEL_SOURCE_BY_VARIANT[activeVariant];

    useEffect(() => {
        let isCancelled = false;
        if (typeof window === 'undefined') return;

        const modelViewerGlobal = window as Window & { ModelViewerElement?: unknown };
        const modelViewerConfig = (modelViewerGlobal.ModelViewerElement ?? {}) as {
            dracoDecoderLocation?: string;
            ktx2TranscoderLocation?: string;
        };
        modelViewerConfig.dracoDecoderLocation = DRACO_DECODER_LOCATION;
        modelViewerConfig.ktx2TranscoderLocation = KTX2_TRANSCODER_LOCATION;
        modelViewerGlobal.ModelViewerElement = modelViewerConfig;

        setErrorReason(null);
        setPhase('booting');

        if (customElements.get('model-viewer')) {
            setPhase('loading');
            return;
        }

        void import('@google/model-viewer')
            .then(() => {
                if (isCancelled) return;
                if (customElements.get('model-viewer')) {
                    setPhase('loading');
                    return;
                }
                setErrorReason('import_failed');
                setPhase('error');
            })
            .catch(() => {
                if (isCancelled) return;
                setErrorReason('import_failed');
                setPhase('error');
            });

        return () => {
            isCancelled = true;
        };
    }, [bootAttemptKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (phase !== 'loading') return;

        const timeoutId = window.setTimeout(() => {
            if (activeVariant === 'primary' && !hasAttemptedFallback) {
                setHasAttemptedFallback(true);
                setActiveVariant('fallback');
                setErrorReason(null);
                setHasVisibleProgress(false);
                setViewerMountKey((value) => value + 1);
                return;
            }
            setErrorReason('timeout');
            setPhase((current) => (current === 'ready' ? current : 'error'));
        }, MODEL_LOAD_TIMEOUT_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [activeVariant, hasAttemptedFallback, phase, viewerMountKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (phase !== 'loading') return;

        const viewer = document.querySelector(`[data-bejroska-viewer="${viewerMountKey}"]`) as
            | (HTMLElement & { loaded?: boolean })
            | null;
        if (!viewer) return;

        if (viewer.loaded) {
            setErrorReason(null);
            setHasVisibleProgress(true);
            setPhase('ready');
            return;
        }

        const handleProgress = (event: Event) => {
            const detail = (event as CustomEvent<{ totalProgress?: number }>).detail;
            if (typeof detail?.totalProgress === 'number' && detail.totalProgress > 0) {
                setHasVisibleProgress(true);
            }
            if (typeof detail?.totalProgress === 'number' && detail.totalProgress >= 1) {
                setErrorReason(null);
                setHasVisibleProgress(true);
                setPhase('ready');
            }
        };

        viewer.addEventListener('progress', handleProgress as EventListener);
        return () => {
            viewer.removeEventListener('progress', handleProgress as EventListener);
        };
    }, [phase, viewerMountKey]);

    const shouldRenderViewer = phase !== 'booting' && errorReason !== 'import_failed';
    const showErrorOverlay = phase === 'error';
    const showBootingOverlay = phase === 'booting';
    const showLoadingBadge = phase === 'loading' && !hasVisibleProgress;
    const errorMessage =
        errorReason === 'import_failed'
            ? 'Nacteni 3D vieweru selhalo.'
            : errorReason === 'primary_error'
                ? 'Primarni model se nepodarilo nacist.'
                : errorReason === 'fallback_error'
                    ? 'Fallback model se nepodarilo nacist.'
                    : errorReason === 'timeout'
                        ? 'Nacitani modelu trva prilis dlouho.'
                        : 'Model se nepodarilo nacist.';
    const handleRetry = () => {
        setErrorReason(null);
        setActiveVariant('primary');
        setHasAttemptedFallback(false);
        setHasVisibleProgress(false);
        setPhase('booting');
        setBootAttemptKey((value) => value + 1);
        setViewerMountKey((value) => value + 1);
    };

    return (
        <div
            className="relative flex h-[288px] w-[288px] items-center justify-center overflow-hidden rounded-[28px] border border-white/15"
            style={{
                background: 'radial-gradient(circle at 50% 28%, rgba(66,75,88,0.9) 0%, rgba(24,29,37,0.96) 56%, rgba(8,10,14,1) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -24px 48px rgba(0,0,0,0.42), 0 18px 36px rgba(0,0,0,0.45)',
            }}
        >
            {shouldRenderViewer ? (
                <ModelViewerTag
                    key={`${activeModelSrc}-${viewerMountKey}`}
                    data-bejroska-viewer={viewerMountKey}
                    src={activeModelSrc}
                    alt="Bejroska hoodie"
                    camera-controls
                    auto-rotate
                    auto-rotate-delay="0"
                    rotation-per-second="22deg"
                    environment-image="neutral"
                    tone-mapping="aces"
                    shadow-intensity="0.8"
                    exposure="1"
                    interaction-prompt="none"
                    loading="eager"
                    style={{ width: '100%', height: '100%', borderRadius: '28px', background: 'transparent' }}
                    onLoad={() => {
                        setErrorReason(null);
                        setHasVisibleProgress(true);
                        setPhase('ready');
                    }}
                    onError={() => {
                        if (activeVariant === 'primary' && !hasAttemptedFallback) {
                            setHasAttemptedFallback(true);
                            setActiveVariant('fallback');
                            setErrorReason(null);
                            setHasVisibleProgress(false);
                            setViewerMountKey((value) => value + 1);
                            return;
                        }
                        setErrorReason(activeVariant === 'primary' ? 'primary_error' : 'fallback_error');
                        setPhase('error');
                    }}
                />
            ) : null}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[28px]"
                style={{
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 -12px 26px rgba(0,0,0,0.35)',
                }}
            />
            {showBootingOverlay ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="suggestion-icon-bubble">
                        <Sparkles className="h-5 w-5 text-[var(--c-action)]" />
                    </div>
                    <p className="max-w-[220px] text-sm text-white/80">Nacitam 3D viewer...</p>
                </div>
            ) : null}
            {showErrorOverlay ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="suggestion-icon-bubble">
                        <Sparkles className="h-5 w-5 text-[var(--c-action)]" />
                    </div>
                    <p className="max-w-[220px] text-sm text-white/80">{errorMessage}</p>
                    <button
                        type="button"
                        className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20"
                        onClick={handleRetry}
                    >
                        Retry
                    </button>
                </div>
            ) : null}
            {showLoadingBadge ? (
                <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/35 px-2 py-1 text-[10px] text-white/70">
                    loading...
                </div>
            ) : null}
        </div>
    );
}
