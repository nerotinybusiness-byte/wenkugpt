'use client';

import { Sparkles } from 'lucide-react';
import { type ElementType, useEffect, useState } from 'react';

const ModelViewerTag = 'model-viewer' as unknown as ElementType;

export default function BejroskaShowcase() {
    const [isReady, setIsReady] = useState(
        () => typeof window !== 'undefined' && Boolean(customElements.get('model-viewer')),
    );
    const [loadError, setLoadError] = useState(false);
    const [modelError, setModelError] = useState(false);

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

    return (
        <div
            className="liquid-glass flex h-[280px] w-[280px] items-center justify-center rounded-[28px] border border-white/20"
            style={{ background: 'color-mix(in srgb, var(--c-glass) 40%, transparent)' }}
        >
            {shouldFallback ? (
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="suggestion-icon-bubble">
                        <Sparkles className="h-5 w-5 text-[var(--c-action)]" />
                    </div>
                    <p className="max-w-[220px] text-sm text-white/80">
                        Nacitam Bejroska model. Pokud se nezobrazi, zavri overlay a zkus to znovu.
                    </p>
                </div>
            ) : (
                <ModelViewerTag
                    src="/models/bejroska-hoodie.glb"
                    alt="Bejroska hoodie"
                    camera-controls
                    auto-rotate
                    shadow-intensity="1"
                    exposure="1"
                    style={{ width: '100%', height: '100%', borderRadius: '28px' }}
                    onError={() => setModelError(true)}
                />
            )}
        </div>
    );
}
