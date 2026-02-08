'use client';

/**
 * WENKUGPT - Chat Page
 * 
 * Split-view layout with chat on left and document preview on right
 * Includes Developer Cockpit panel
 */

import { useState, useCallback } from 'react';
import ChatPanel from '@/components/chat/ChatPanel';
import DocumentPreview from '@/components/preview/DocumentPreview';
import CockpitPanel from '@/components/cockpit/CockpitPanel';

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

export default function ChatPage() {
    const [sources, setSources] = useState<Source[]>([]);
    const [activeHighlight, setActiveHighlight] = useState<ActiveHighlight | null>(null);

    // Handle citation click - trigger Golden Glow
    const handleCitationClick = useCallback((citation: ActiveHighlight) => {
        setActiveHighlight(citation);

        // Clear highlight after animation
        setTimeout(() => {
            setActiveHighlight(null);
        }, 3500);
    }, []);

    // Handle sources update from chat
    const handleSourcesChange = useCallback((newSources: Source[]) => {
        setSources(newSources);
    }, []);

    return (
        <main className="split-view min-h-screen dark">
            {/* Background gradient */}
            <div className="bg-liquid-glass" />

            {/* Developer Cockpit */}
            <CockpitPanel />

            {/* Left Panel: Chat */}
            <section className="min-h-0">
                <ChatPanel
                    onCitationClick={handleCitationClick}
                    onSourcesChange={handleSourcesChange}
                />
            </section>

            {/* Right Panel: Document Preview */}
            <section className="min-h-0">
                <DocumentPreview
                    sources={sources}
                    activeHighlight={activeHighlight}
                />
            </section>
        </main>
    );
}
