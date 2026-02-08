'use client';

/**
 * WENKUGPT - Message Bubble Component
 * 
 * iMessage-style glass bubble with citation parsing
 */

import { useMemo } from 'react';
import CitationLink from './CitationLink';

interface Source {
    id: string;
    chunkId: string;
    pageNumber: number;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    content: string;
    filename?: string;
}

interface MessageBubbleProps {
    /** Message content */
    content: string;
    /** Whether this is a user message */
    isUser: boolean;
    /** Source citations (for AI messages) */
    sources?: Source[];
    /** Whether the message is loading */
    isLoading?: boolean;
    /** Verification status */
    verified?: boolean;
    /** Confidence score */
    confidence?: number;
    /** Callback when citation is clicked */
    onCitationClick?: (citation: {
        id: string;
        chunkId: string;
        pageNumber: number;
        boundingBox: { x: number; y: number; width: number; height: number } | null;
    }) => void;
}

/**
 * Parse message content and replace [ID] with CitationLink components
 */
function parseContentWithCitations(
    content: string,
    sources: Source[],
    onCitationClick?: MessageBubbleProps['onCitationClick']
): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const citationRegex = /\[(\d+)\]/g;
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(content)) !== null) {
        // Add text before citation
        if (match.index > lastIndex) {
            parts.push(content.slice(lastIndex, match.index));
        }

        // Find source for this citation
        const citationId = match[1];
        const source = sources.find(s => s.id === citationId);

        if (source) {
            parts.push(
                <CitationLink
                    key={`citation-${match.index}`}
                    id={citationId}
                    chunkId={source.chunkId}
                    pageNumber={source.pageNumber}
                    boundingBox={source.boundingBox}
                    onCitationClick={onCitationClick}
                />
            );
        } else {
            // No source found, render as plain text
            parts.push(match[0]);
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
    }

    return parts;
}

export default function MessageBubble({
    content,
    isUser,
    sources = [],
    isLoading = false,
    verified,
    confidence,
    onCitationClick,
}: MessageBubbleProps) {
    const parsedContent = useMemo(() => {
        if (isUser || sources.length === 0) {
            return content;
        }
        return parseContentWithCitations(content, sources, onCitationClick);
    }, [content, isUser, sources, onCitationClick]);

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div
                className={`
          max-w-[80%] px-4 py-3 rounded-2xl
          ${isUser
                        ? 'glass-bubble text-white'
                        : 'glass-bubble-received'
                    }
          ${isLoading ? 'animate-pulse' : ''}
        `}
            >
                {/* Message content */}
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {isLoading ? (
                        <span className="thinking-dots">Přemýšlím</span>
                    ) : (
                        parsedContent
                    )}
                </div>

                {/* Verification badge for AI messages */}
                {!isUser && !isLoading && verified !== undefined && (
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2 text-xs opacity-70">
                        <span className={verified ? 'text-green-400' : 'text-yellow-400'}>
                            {verified ? '✓ Ověřeno' : '⚠️ Neověřeno'}
                        </span>
                        {confidence !== undefined && (
                            <span>({Math.round(confidence * 100)}%)</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
