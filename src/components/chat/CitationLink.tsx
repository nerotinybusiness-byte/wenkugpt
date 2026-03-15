'use client';

/**
 * WENKUGPT - Citation Link Component
 * 
 * Clickable [ID] citation that triggers Golden Glow in PDF preview
 */

import { useCallback } from 'react';

export interface CitationPayload {
    id: string;
    chunkId: string;
    pageNumber: number;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }> | null;
    highlightText?: string | null;
    filename?: string;
    originalFilename?: string | null;
    title?: string;
    contextText?: string;
}

interface CitationLinkProps {
    /** Citation ID (e.g., "1", "2") */
    id: string;
    /** Chunk ID for highlight lookup */
    chunkId: string;
    /** Page number */
    pageNumber: number;
    /** Bounding box coordinates */
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    /** Fine-grained highlight boxes */
    highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }> | null;
    /** Ingest-time short snippet for text-layer anchoring */
    highlightText?: string | null;
    /** Source filename */
    filename?: string;
    /** Original document filename for UI */
    originalFilename?: string | null;
    /** Source title (legacy fallback) */
    title?: string;
    /** Nearby answer text around the citation marker (used for precise text-layer highlight) */
    contextText?: string;
    /** Callback when citation is clicked */
    onCitationClick?: (citation: CitationPayload) => void;
}

export default function CitationLink({
    id,
    chunkId,
    pageNumber,
    boundingBox,
    highlightBoxes,
    highlightText,
    filename,
    originalFilename,
    title,
    contextText,
    onCitationClick,
}: CitationLinkProps) {
    const handleClick = useCallback(() => {
        console.log('CitationLink: clicked', id, filename);
        onCitationClick?.({
            id,
            chunkId,
            pageNumber,
            boundingBox,
            highlightBoxes,
            highlightText,
            filename,
            originalFilename,
            title,
            contextText,
        });
    }, [id, chunkId, pageNumber, boundingBox, highlightBoxes, highlightText, filename, originalFilename, title, contextText, onCitationClick]);

    return (
        <button
            onClick={handleClick}
            className="inline-flex items-center justify-center font-mono text-xs font-bold text-yellow-600 dark:text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded px-1.5 py-0.5 mx-0.5 cursor-pointer transition-colors select-none"
            title={`Strana ${pageNumber} - Klikni pro zvýraznění`}
            aria-label={`Citace ${id}, strana ${pageNumber}`}
        >
            [{id}]
        </button>
    );
}
