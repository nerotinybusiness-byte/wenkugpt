'use client';

import { Sparkles } from 'lucide-react';
import { type ElementType, useEffect, useState } from 'react';

const MODEL_VIEWER_SCRIPT_ID = 'google-model-viewer-script';
const ModelViewerTag = 'model-viewer' as unknown as ElementType;

export default function BejroskaShowcase() {
    const [isReady, setIsReady] = useState(
        () => typeof window !== 'undefined' && Boolean(customElements.get('model-viewer')),
    );
    const [loadError, setLoadError] = useState(false);
    const [modelError, setModelError] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (customElements.get('model-viewer')) return;

        const existing = document.getElementById(MODEL_VIEWER_SCRIPT_ID) as HTMLScriptElement | null;
        if (existing) {
            const onLoad = () => setIsReady(true);
            const onError = () => setLoadError(true);
            existing.addEventListener('load', onLoad);
            existing.addEventListener('error', onError);
            return () => {
                existing.removeEventListener('load', onLoad);
                existing.removeEventListener('error', onError);
            };
        }

        const script = document.createElement('script');
        script.id = MODEL_VIEWER_SCRIPT_ID;
        script.type = 'module';
        script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
        script.onload = () => setIsReady(true);
        script.onerror = () => setLoadError(true);
        document.head.appendChild(script);
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
                        Bejroska show pripraven. Vloz model do
                        {' '}
                        <code className="rounded bg-black/30 px-1 py-0.5 text-xs">public/models/bejroska-hoodie.glb</code>
                        .
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
