'use client';

/**
 * WENKUGPT - Document Preview with Golden Glow
 * 
 * Displays sources with animated highlight on citation click
 */

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Source {
    id: string;
    chunkId: string;
    documentId: string;
    content: string;
    pageNumber: number;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    parentHeader: string | null;
    filename?: string;
    relevanceScore: number;
}

interface ActiveHighlight {
    id: string;
    chunkId: string;
    pageNumber: number;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
}

interface DocumentPreviewProps {
    /** Available sources from chat */
    sources: Source[];
    /** Currently active highlight */
    activeHighlight: ActiveHighlight | null;
}

export default function DocumentPreview({ sources, activeHighlight }: DocumentPreviewProps) {
    const highlightRef = useRef<HTMLDivElement>(null);

    // Scroll to and animate highlight when it changes
    useEffect(() => {
        if (activeHighlight && highlightRef.current) {
            highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [activeHighlight]);

    if (sources.length === 0) {
        return (
            <div className="flex flex-col h-full glass rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/10">
                    <h2 className="text-lg font-semibold">📄 Náhled dokumentu</h2>
                    <p className="text-xs opacity-60">Klikněte na citaci pro zvýraznění</p>
                </div>

                {/* Empty state */}
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center opacity-40">
                        <div className="text-6xl mb-4">📚</div>
                        <p>Položte otázku v chatu</p>
                        <p className="text-sm">pro zobrazení relevantních zdrojů</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full glass rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
                <h2 className="text-lg font-semibold">📄 Náhled dokumentu</h2>
                <p className="text-xs opacity-60">
                    {sources.length} zdrojů nalezeno • Klikněte na [ID] pro zvýraznění
                </p>
            </div>

            {/* Sources list */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    {sources.map(source => {
                        const isActive = activeHighlight?.chunkId === source.chunkId;

                        return (
                            <div
                                key={source.chunkId}
                                ref={isActive ? highlightRef : undefined}
                                className={`
                  relative p-4 rounded-xl glass-light
                  transition-all duration-300
                  ${isActive ? 'golden-glow' : ''}
                `}
                            >
                                {/* Source header */}
                                <div className="flex items-center gap-2 mb-2 text-xs">
                                    <span className="citation-link pointer-events-none">
                                        [{source.id}]
                                    </span>
                                    <span className="opacity-60">{source.filename || 'Dokument'}</span>
                                    <span className="opacity-40">•</span>
                                    <span className="opacity-60">Strana {source.pageNumber}</span>
                                    {source.parentHeader && (
                                        <>
                                            <span className="opacity-40">•</span>
                                            <span className="opacity-60 truncate max-w-[200px]">
                                                {source.parentHeader}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Source content */}
                                <div className="text-sm leading-relaxed opacity-80 whitespace-pre-wrap">
                                    {source.content}
                                </div>

                                {/* Relevance indicator */}
                                <div className="mt-2 flex items-center gap-2 text-xs opacity-40">
                                    <div
                                        className="h-1 rounded-full bg-current"
                                        style={{
                                            width: `${Math.round(source.relevanceScore * 100)}px`,
                                            maxWidth: '100px'
                                        }}
                                    />
                                    <span>{Math.round(source.relevanceScore * 100)}% shoda</span>
                                </div>

                                {/* Bounding box visualization (if available) */}
                                {source.boundingBox && isActive && (
                                    <div
                                        className="absolute pointer-events-none border-2 border-amber-400/50 rounded"
                                        style={{
                                            left: `${source.boundingBox.x * 100}%`,
                                            top: `${source.boundingBox.y * 100}%`,
                                            width: `${source.boundingBox.width * 100}%`,
                                            height: `${source.boundingBox.height * 100}%`,
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
