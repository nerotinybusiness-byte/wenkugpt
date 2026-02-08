'use client';

/**
 * WENKUGPT - Chat Panel Component
 * 
 * Main chat interface with message history and input
 * Integrated with Zustand settings store
 */

// ... imports
import { useState, useCallback, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettings } from '@/lib/settings/store';
import { PrivacyBadge } from '@/components/ui/PrivacyBadge';
import Link from 'next/link';
import { FileText, Sun, Moon, Settings, MessageSquarePlus } from 'lucide-react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import EmptyState from './EmptyState';
import { Button } from '@/components/ui/button';
import ThemeSwitcher from '@/components/ThemeSwitcher';


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

interface Message {
    id: string;
    content: string;
    isUser: boolean;
    sources?: Source[];
    verified?: boolean;
    confidence?: number;
    isLoading?: boolean;
}

interface ChatPanelProps {
    onCitationClick?: (citation: any) => void;
    onSourcesChange?: (sources: Source[]) => void;
}

export default function ChatPanel({ onCitationClick, onSourcesChange }: ChatPanelProps) {
    const settings = useSettings();
    const { setLastStats } = settings;

    // Start empty to show EmptyState
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            content: content.trim(),
            isUser: true,
        };

        const loadingMessage: Message = {
            id: `ai-${Date.now()}`,
            content: '',
            isUser: false,
            isLoading: true,
        };

        setMessages(prev => [...prev, userMessage, loadingMessage]);
        setIsLoading(true);

        try {
            const settingsPayload = {
                vectorWeight: settings.vectorWeight,
                textWeight: settings.textWeight,
                minScore: settings.minScore,
                searchLimit: settings.searchLimit,
                topK: settings.topK,
                minRelevance: settings.minRelevance,
                generatorModel: settings.generatorModel,
                auditorModel: settings.auditorModel,
                temperature: settings.temperature,
                enableAuditor: settings.enableAuditor,
                confidenceThreshold: settings.confidenceThreshold,
            };

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: userMessage.content,
                    settings: settingsPayload,
                }),
            });

            const data = await response.json();

            setMessages(prev =>
                prev.map(msg =>
                    msg.id === loadingMessage.id
                        ? {
                            ...msg,
                            content: data.response || 'Omlouvám se, nepodařilo se zpracovat odpověď.',
                            isLoading: false,
                            sources: data.sources || [],
                            verified: data.verified,
                            confidence: data.confidence,
                        }
                        : msg
                )
            );

            if (data.stats) setLastStats(data.stats);
            if (data.sources && onSourcesChange) onSourcesChange(data.sources);

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === loadingMessage.id
                        ? {
                            ...msg,
                            content: 'Omlouvám se, nastala chyba při komunikaci se serverem.',
                            isLoading: false,
                        }
                        : msg
                )
            );
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, onSourcesChange, settings, setLastStats]);

    const handleRegenerate = (messageId: string) => {
        // Placeholder for regeneration logic - could reuse handleSendMessage with previous user prompt
        console.log('Regenerate', messageId);
    };



    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="flex h-screen w-full overflow-hidden transition-colors duration-400">
            {/* Main Content */}
            <div className="flex-1 flex flex-col relative min-w-0 h-full">
                {/* Header */}
                <header className="absolute top-0 left-0 right-0 h-24 flex items-center justify-between px-6 z-50 pointer-events-none">
                    <div className="relative pointer-events-auto" ref={menuRef}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="liquid-glass w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all text-[var(--c-content)] hover:text-[var(--c-action)] group relative z-50"
                        >
                            <div className="flex flex-col gap-1.5 items-center justify-center w-5 transition-transform duration-200 group-hover:scale-110">
                                <div className={`w-full h-0.5 bg-current rounded-full transition-transform duration-300 ${isMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
                                <div className={`w-full h-0.5 bg-current rounded-full transition-opacity duration-300 ${isMenuOpen ? "opacity-0" : ""}`} />
                                <div className={`w-full h-0.5 bg-current rounded-full transition-transform duration-300 ${isMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
                            </div>
                        </button>

                        {/* Rollout Menu */}
                        <div
                            className={`
                                absolute top-full left-0 mt-4 w-64 liquid-glass rounded-2xl p-2 origin-top transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] transform overflow-hidden
                                ${isMenuOpen
                                    ? "opacity-100 scale-y-100 translate-y-0"
                                    : "opacity-0 scale-y-0 -translate-y-4 pointer-events-none"
                                }
                            `}
                        >
                            <div className="flex flex-col gap-2">
                                <button
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--c-glass)]/20 transition-colors text-[var(--c-content)] hover:text-[var(--c-action)] group active:scale-95"
                                    onClick={() => {
                                        setMessages([]);
                                        setIsMenuOpen(false);
                                    }}
                                >
                                    <MessageSquarePlus size={20} className="transition-transform duration-200 group-hover:scale-110" />
                                    <span className="font-medium">New Chat</span>
                                </button>

                                <Link href="/files" onClick={() => setIsMenuOpen(false)}>
                                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--c-glass)]/20 transition-colors text-[var(--c-content)] hover:text-[var(--c-action)] group active:scale-95">
                                        <FileText size={20} className="transition-transform duration-200 group-hover:scale-110" />
                                        <div className="text-sm font-medium">Manage Files</div>
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>


                    {/* Spacer/Title placeholder if needed */}
                    <div />

                    <div className="pointer-events-auto flex items-center justify-center scale-75 origin-right">
                        <ThemeSwitcher />
                    </div>
                </header>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto pt-28 pb-32 px-4 md:px-12 lg:px-24" ref={scrollRef}>
                    <div className="max-w-3xl mx-auto space-y-8">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4 pt-20">
                                <FileText size={48} className="text-[var(--c-content)]" />
                                <h2 className="text-2xl font-bold text-[var(--c-content)]">WenkuGPT</h2>
                                <p className="text-[var(--c-content)]">Start a conversation below.</p>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <ChatMessage
                                    key={message.id}
                                    message={{
                                        id: message.id,
                                        content: message.content,
                                        role: message.isUser ? 'user' : 'assistant',
                                        sources: message.sources,
                                        isLoading: message.isLoading
                                    }}
                                    onCitationClick={onCitationClick}
                                    onRegenerate={!message.isUser ? () => handleRegenerate(message.id) : undefined}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 bg-gradient-to-t from-[var(--c-bg)] to-transparent pointer-events-none">
                    <div className="max-w-3xl mx-auto relative pointer-events-auto">
                        <form
                            onSubmit={(e) => { e.preventDefault(); }}
                            className="liquid-glass relative flex items-end w-full rounded-[2rem] p-2 transition-all duration-300 focus-within:ring-2 ring-[var(--c-action)]/50"
                        >
                            <ChatInput onSend={handleSendMessage} disabled={isLoading} />
                        </form>
                        <div className="text-center mt-3 text-xs text-[var(--c-content)]/50 font-medium">
                            Liquid Glass LLM uses CSS Best Practices for premium aesthetics.
                        </div>
                    </div>
                </div>
            </div >
        </div >
    );
}
