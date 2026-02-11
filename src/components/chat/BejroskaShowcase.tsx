'use client';

import { Sparkles } from 'lucide-react';
import { type ElementType, useEffect, useState } from 'react';

const ModelViewerTag = 'model-viewer' as unknown as ElementType;
const BEJROSKA_MODEL_SRC = '/models/bejroska-hoodie.glb?v=2026-02-11-compressed-2';
const BEJROSKA_COMPAT_MODEL_SRC = '/models/old_bejroska-hoodie.glb?v=2026-02-11-compat-1';

export default function BejroskaShowcase() {
    const [isReady, setIsReady] = useState(
        () => typeof window !== 'undefined' && Boolean(customElements.get('model-viewer')),
    );
    const [loadError, setLoadError] = useState(false);
    const [modelError, setModelError] = useState(false);
    const [useCompatModel, setUseCompatModel] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);

    useEffect(() => {
        let isCancelled = false;
        if (typeof window === 'undefined') return;
        if (customElements.get('model-viewer')) return;

        void import('@google/model-viewer')
            .then(() => {
                if (isCancelled) return;
                setIsReady(Boolean(customElements.get('model-viewer')));
            })
            .catch(() => {
                if (isCancelled) return;
                setLoadError(true);
            });

        return () => {
            isCancelled = true;
        };
    }, []);

    const shouldFallback = loadError || modelError || !isReady;
    const modelSrc = useCompatModel ? BEJROSKA_COMPAT_MODEL_SRC : BEJROSKA_MODEL_SRC;

    return (
        <div
            className="relative flex h-[288px] w-[288px] items-center justify-center overflow-hidden rounded-[28px] border border-white/15"
            style={{
                background: 'radial-gradient(circle at 50% 28%, rgba(66,75,88,0.9) 0%, rgba(24,29,37,0.96) 56%, rgba(8,10,14,1) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -24px 48px rgba(0,0,0,0.42), 0 18px 36px rgba(0,0,0,0.45)',
            }}
        >
            {shouldFallback ? (
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="suggestion-icon-bubble">
                        <Sparkles className="h-5 w-5 text-[var(--c-action)]" />
                    </div>
                    <p className="max-w-[220px] text-sm text-white/80">
                        Nacitam Bejroska model. Pokud se nezobrazi, zkusim kompatibilni variantu automaticky.
                    </p>
                </div>
            ) : (
                <>
                    <ModelViewerTag
                        key={modelSrc}
                        src={modelSrc}
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
                        onLoad={() => setIsModelLoaded(true)}
                        onError={() => {
                            if (!useCompatModel) {
                                setUseCompatModel(true);
                                setIsModelLoaded(false);
                                return;
                            }
                            setModelError(true);
                        }}
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-[28px]"
                        style={{
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 -12px 26px rgba(0,0,0,0.35)',
                        }}
                    />
                    {useCompatModel ? (
                        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/35 px-2 py-1 text-[10px] text-white/70">
                            compat mode
                        </div>
                    ) : null}
                    {!isModelLoaded ? (
                        <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/35 px-2 py-1 text-[10px] text-white/70">
                            loading...
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}
