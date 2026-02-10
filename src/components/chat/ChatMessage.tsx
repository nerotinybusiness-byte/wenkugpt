'use client';

import { useMemo } from 'react';
import { RefreshCw, User, Bot } from 'lucide-react';
import CitationLink from './CitationLink';
import type { CitationPayload } from './CitationLink';

interface Source {
    id: string;
    chunkId: string;
    pageNumber: number;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }> | null;
    content: string;
    filename?: string;
    originalFilename?: string | null;
    title?: string;
}

interface ChatMessageProps {
    message: {
        id: string;
        content: string;
        role: 'user' | 'assistant';
        sources?: Source[];
        isLoading?: boolean;
    };
    onRegenerate?: () => void;
    onCitationClick?: (citation: CitationPayload) => void;
}

export default function ChatMessage({ message, onRegenerate, onCitationClick }: ChatMessageProps) {
    const isUser = message.role === 'user';

    const parsedContent = useMemo(() => {
        if (isUser || !message.sources?.length) return message.content;

        const parts: React.ReactNode[] = [];
        const citationRegex = /\[(\d+)\]/g;
        let lastIndex = 0;
        let match;

        while ((match = citationRegex.exec(message.content)) !== null) {
            if (match.index > lastIndex) {
                parts.push(message.content.slice(lastIndex, match.index));
            }

            const citationId = match[1];
            const source = message.sources.find(s => s.id === citationId);

            if (source) {
                parts.push(
                    <CitationLink
                        key={`citation-${match.index}`}
                        id={citationId}
                        chunkId={source.chunkId}
                        pageNumber={source.pageNumber}
                        boundingBox={source.boundingBox}
                        highlightBoxes={source.highlightBoxes}
                        filename={source.filename ?? source.title}
                        originalFilename={source.originalFilename ?? source.filename ?? source.title}
                        title={source.title}
                        onCitationClick={onCitationClick}
                    />
                );
            } else {
                parts.push(match[0]);
            }
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < message.content.length) {
            parts.push(message.content.slice(lastIndex));
        }

        return parts;
    }, [message.content, isUser, message.sources, onCitationClick]);

    if (message.isLoading) {
        return (
            <div className="message-fade-in mb-6">
                <div className="flex items-start gap-4 md:gap-6">
                    <div className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mt-1 bg-[var(--c-glass)]/20">
                        <Bot size={20} className="text-[var(--c-action)] animate-pulse" />
                    </div>
                    <div className="flex-1 pt-2">
                        <div
                            className="inline-flex items-center gap-1.5 px-5 py-4 rounded-2xl liquid-glass rounded-tl-sm"
                        >
                            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--c-action)]" style={{ animationDelay: '0ms' }}></span>
                            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--c-action)]" style={{ animationDelay: '150ms' }}></span>
                            <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--c-action)]" style={{ animationDelay: '300ms' }}></span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex gap-4 md:gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 mb-6 ${isUser ? "flex-row-reverse" : "flex-row"
                }`}
        >
            <div className={`shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center mt-1 bg-[var(--c-glass)]/20`}>
                {isUser ? <User size={20} className="text-[var(--c-content)]" /> : <Bot size={20} className="text-[var(--c-action)]" />}
            </div>

            <div className={`flex flex-col max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                <div
                    className={`
                        px-5 py-4 text-[15px] md:text-base leading-relaxed rounded-2xl whitespace-pre-wrap
                        ${isUser
                            ? "bg-[var(--c-action)] text-[#000] rounded-tr-sm font-medium"
                            : "liquid-glass rounded-tl-sm text-[var(--c-content)]"
                        }
                    `}
                >
                    {parsedContent}

                    {/* Citations/Sources Footer */}
                    {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-black/10 flex flex-wrap gap-2">
                            {message.sources.map((source, idx) => (
                                <CitationLink
                                    key={idx}
                                    id={source.id || idx.toString()}
                                    chunkId={source.chunkId}
                                    pageNumber={source.pageNumber}
                                    boundingBox={source.boundingBox}
                                    highlightBoxes={source.highlightBoxes}
                                    filename={source.filename ?? source.title}
                                    originalFilename={source.originalFilename ?? source.filename ?? source.title}
                                    title={source.title}
                                    onCitationClick={onCitationClick}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {!isUser && !message.isLoading && onRegenerate && (
                    <div className="flex items-center gap-2 mt-2 opacity-50 hover:opacity-100 transition-opacity">
                        <button
                            onClick={onRegenerate}
                            className="p-1.5 rounded-full hover:bg-[var(--c-glass)]/20 transition-colors text-[var(--c-content)]"
                            title="Regenerate response"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
