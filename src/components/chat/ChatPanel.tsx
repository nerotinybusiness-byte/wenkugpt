'use client';

/**
 * WENKUGPT - Chat Panel Component
 * 
 * Main chat interface with message history and input
 * Integrated with Zustand settings store
 */

// ... imports
import { useState, useCallback, useRef, useEffect } from 'react';
import { useSettings, getSettings, type SettingsState } from '@/lib/settings/store';
import { FileText, MessageSquarePlus, History, Trash2 } from 'lucide-react';

import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import EmptyState from './EmptyState';
import type { CitationPayload } from './CitationLink';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { SettingsDialog } from './SettingsDialog';
import { ManageFilesDialog } from './ManageFilesDialog';
import dynamic from 'next/dynamic';
import { apiFetch } from '@/lib/api/client-request';

const PDFViewer = dynamic(() => import('./PDFViewer'), {
    ssr: false,
    loading: () => null
});

interface Source {
    id: string;
    chunkId: string;
    documentId: string;
    content: string;
    pageNumber: number;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    highlightBoxes?: Array<{ x: number; y: number; width: number; height: number }> | null;
    highlightText?: string | null;
    parentHeader: string | null;
    filename?: string;
    originalFilename?: string | null;
    title?: string;
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
    onCitationClick?: (citation: CitationPayload) => void;
    onSourcesChange?: (sources: Source[]) => void;
}

interface HistoryItem {
    id: string;
    title: string;
}

interface ChatApiMessage {
    id: string;
    content: string;
    role: 'user' | 'assistant' | 'system';
    sources?: Source[] | null;
}

interface ApiSuccess<T> {
    success: true;
    data: T;
    error: null;
    code: null;
}

interface ApiError {
    success: false;
    data: null;
    error?: string;
    code?: string;
    details?: string;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

interface ChatPostResponseData {
    chatId: string;
    response: string;
    sources: Source[];
    verified: boolean;
    confidence: number;
    stats?: SettingsState['lastStats'];
    interpretation?: {
        detectedTerms: string[];
        resolvedConcepts: Array<{
            conceptId: string;
            conceptKey: string;
            alias: string;
            definitionVersionId: string | null;
            confidence: number;
        }>;
        definitionVersionIds: string[];
        rewrittenQuery?: string;
    };
    ambiguities?: Array<{
        term: string;
        candidateConcepts: string[];
        reason: string;
    }>;
    engineMeta?: {
        engine: 'v1' | 'v2';
        mode: 'compat' | 'graph';
    };
}

export default function ChatPanel({ onCitationClick, onSourcesChange }: ChatPanelProps) {
    // Only subscribe to the action, not the state values
    const setLastStats = useSettings((state) => state.setLastStats);

    // Start empty to show EmptyState
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [chatId, setChatId] = useState<string | null>(null);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isManageFilesOpen, setIsManageFilesOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    // PDF Viewer State
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfTitle, setPdfTitle] = useState<string>('');
    const [isPdfOpen, setIsPdfOpen] = useState(false);
    const [initialPage, setInitialPage] = useState<number>(1);
    const [highlights, setHighlights] = useState<Array<{ page: number; bbox: NonNullable<Source['boundingBox']> }>>([]);
    const [highlightContext, setHighlightContext] = useState<string>('');

    const normalizeDisplayFilename = (name: string): string => {
        const basename = name.split(/[/\\]/).pop() || name;
        return basename.replace(/^[^_]+_[0-9a-fA-F-]{36}_/, '');
    };

    const getDisplayFilename = (source: CitationPayload): string => {
        const raw = source.originalFilename || source.title || source.filename || 'Document';
        if (!raw.trim()) return 'Document';
        const basename = raw.split(/[/\\]/).pop() || raw;
        return normalizeDisplayFilename(basename);
    };

    const onCitationSelect = (source: CitationPayload) => {
        console.log('ChatPanel: Citation clicked', source);
        onCitationClick?.(source);

        // Defensive check for filename
        if (!source || (!source.filename && !source.title && !source.originalFilename)) {
            console.warn('ChatPanel: Citation has no filename or title', source);
            return;
        }

        const filename = source.filename || source.title || source.originalFilename || 'Document';

        if (filename) {
            // Heuristic for PDF handling
            if (filename.startsWith('http')) {
                setPdfUrl(filename);
            } else {
                // Use Supabase Storage Public URL
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                if (supabaseUrl) {
                    setPdfUrl(`${supabaseUrl}/storage/v1/object/public/documents/${filename}`);
                } else {
                    // Fallback for local dev if env missing (shouldn't happen)
                    setPdfUrl(`/documents/${filename}`);
                }
            }
            setPdfTitle(getDisplayFilename(source));
            setInitialPage(source.pageNumber || 1);
            setHighlightContext((source.contextText || source.highlightText || '').trim());

            // Set highlight boxes with fallback to the coarse chunk bounding box.
            if (source.highlightBoxes && source.highlightBoxes.length > 0) {
                setHighlights(
                    source.highlightBoxes.map((bbox) => ({
                        page: source.pageNumber,
                        bbox,
                    }))
                );
            } else if (source.boundingBox) {
                setHighlights([{
                    page: source.pageNumber,
                    bbox: source.boundingBox,
                }]);
            } else {
                setHighlights([]);
            }

            setIsPdfOpen(true);
        } else {
            console.error('ChatPanel: Source has no filename', source);
        }

    };

    const loadChat = async (id: string) => {
        setIsMenuOpen(false);
        setChatId(id);
        setMessages([]); // Clear while loading
        setIsLoading(true);

        try {
            const res = await apiFetch(`/api/chat?chatId=${id}`);
            const payload = await res.json() as ApiResponse<{ messages: ChatApiMessage[] }>;

            if (payload.success && payload.data.messages) {
                const loadedMessages = payload.data.messages.map((msg) => ({
                    id: msg.id,
                    content: msg.content,
                    isUser: msg.role === 'user',
                    sources: msg.sources || undefined,
                }));
                setMessages(loadedMessages);
            }
        } catch (error) {
            console.error('Failed to load chat', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

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

    // Load history when menu opens
    useEffect(() => {
        if (isMenuOpen) {
            apiFetch('/api/history?limit=20')
                .then(res => res.json())
                .then((payload: ApiResponse<{ history: HistoryItem[] }>) => {
                    if (payload.success && payload.data.history) {
                        setHistory(payload.data.history);
                    }
                })
                .catch(err => console.error('Failed to load history', err));
        }
    }, [isMenuOpen]);

    const submitQuery = useCallback(async (query: string, currentChatId: string | null) => {
        try {
            // Use getSettings() to access current state without subscribing
            const settings = getSettings();

            const settingsPayload = {
                ragEngine: settings.ragEngine,
                contextScope: {
                    team: settings.contextScope.team || undefined,
                    product: settings.contextScope.product || undefined,
                    region: settings.contextScope.region || undefined,
                    process: settings.contextScope.process || undefined,
                },
                effectiveAt: settings.effectiveAt || undefined,
                ambiguityPolicy: settings.ambiguityPolicy,
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

            const response = await apiFetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    settings: settingsPayload,
                    chatId: currentChatId,
                }),
                signal: abortControllerRef.current?.signal,
            });


            const payload = await response.json() as ApiResponse<ChatPostResponseData>;

            if (!payload.success) {
                console.error('Chat API Error Details:', payload.details);
                throw new Error(payload.error || 'Failed to get response');
            }

            const data = payload.data;

            // Update Chat ID if new session started
            if (data.chatId && data.chatId !== currentChatId) {
                setChatId(data.chatId);
            }

            // Update messages with real response
            setMessages(prev => {
                const newMessages = [...prev];
                // Remove loading message
                newMessages.pop();

                // Add AI response
                newMessages.push({
                    id: `ai-${Date.now()}`,
                    content: data.response,
                    isUser: false,
                    sources: data.sources,
                    verified: data.verified,
                    confidence: data.confidence,
                });

                // Update usage stats in store
                if (data.stats) {
                    setLastStats(data.stats);
                }

                return newMessages;
            });

            if (data.sources && onSourcesChange) onSourcesChange(data.sources);


        } catch (error: unknown) {
            const isAbortError = error instanceof Error && error.name === 'AbortError';

            if (isAbortError) {
                console.log('Chat request aborted');
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIdx = newMessages.findIndex((m) => m.isLoading);
                    if (lastIdx !== -1) {
                        newMessages.splice(lastIdx, 1, {
                            id: `stop-${Date.now()}`,
                            content: 'Generov\u00E1n\u00ED bylo zastaveno.',
                            isUser: false,
                        });
                    }
                    return newMessages;
                });
            } else {
                console.error('Chat error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Nezn\u00E1m\u00E1 chyba';
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages.pop(); // Remove loading
                    newMessages.push({
                        id: `error-${Date.now()}`,
                        content: `Do\u0161lo k chyb\u011B: ${errorMessage}`,
                        isUser: false,
                    });
                    return newMessages;
                });
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }

    }, [onSourcesChange, setLastStats]);

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

        // Abort previous request if any (though UI prevents this)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        // Timeout safeguard (60s)
        const timeoutId = setTimeout(() => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        }, 60000);

        try {
            await submitQuery(content.trim(), chatId);
        } finally {
            clearTimeout(timeoutId);
        }
    }, [isLoading, chatId, submitQuery]);


    const handleRegenerate = useCallback(async (messageId: string) => {
        if (isLoading) return;

        setMessages(prev => {
            const index = prev.findIndex(m => m.id === messageId);
            if (index === -1) return prev;

            // Find previous user message
            const prevMessage = prev[index - 1];
            if (!prevMessage || !prevMessage.isUser) return prev;

            // Keep everything up to the user message
            const newHistory = prev.slice(0, index);

            // Add loading message
            newHistory.push({
                id: `ai-${Date.now()}`,
                content: '',
                isUser: false,
                isLoading: true,
            });

            // Trigger query in background (using setTimeout to break render cycle)
            setTimeout(() => submitQuery(prevMessage.content, chatId), 0);

            return newHistory;
        });

        setIsLoading(true);
    }, [isLoading, chatId, submitQuery]);

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
                            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={isMenuOpen}
                            aria-haspopup="true"
                        >
                            <div className="flex flex-col gap-1.5 items-center justify-center w-5 transition-transform duration-200 group-hover:scale-110">
                                <div className={`w-full h-0.5 bg-current rounded-full transition-transform duration-300 ${isMenuOpen ? "rotate-45 translate-y-2" : ""}`} />
                                <div className={`w-full h-0.5 bg-current rounded-full transition-opacity duration-300 ${isMenuOpen ? "opacity-0" : ""}`} />
                                <div className={`w-full h-0.5 bg-current rounded-full transition-transform duration-300 ${isMenuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
                            </div>
                        </button>

                        {/* Rollout Menu Container - Wrapper for animation only, transparent */}
                        <div
                            className={`
                                absolute top-full left-0 mt-4 w-64 origin-top transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] transform
                                ${isMenuOpen
                                    ? "opacity-100 scale-y-100 translate-y-0"
                                    : "opacity-0 scale-y-0 -translate-y-4 pointer-events-none"
                                }
                            `}
                        >
                            {/* Block 1: Actions */}
                            <div className="liquid-glass rounded-2xl p-2 mb-2">
                                <button
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--c-glass)]/20 transition-colors text-[var(--c-content)] hover:text-[var(--c-action)] group active:scale-95"
                                    onClick={() => {
                                        setMessages([]);
                                        setChatId(null);
                                        setIsMenuOpen(false);
                                    }}
                                >
                                    <MessageSquarePlus size={20} className="transition-transform duration-200 group-hover:scale-110" />
                                    <span className="font-medium">New Chat</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        setIsManageFilesOpen(true);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--c-glass)]/20 transition-colors text-[var(--c-content)] hover:text-[var(--c-action)] group active:scale-95"
                                >
                                    <FileText size={20} className="transition-transform duration-200 group-hover:scale-110" />
                                    <div className="text-sm font-medium">Manage Files</div>
                                </button>

                                <SettingsDialog />
                            </div>

                            {/* Block 2: History */}
                            <div className="liquid-glass rounded-2xl p-2 max-h-64 overflow-y-auto custom-scrollbar" >
                                <div className="px-4 py-2 text-xs font-medium text-[var(--c-content)]/50 uppercase tracking-wider flex items-center gap-2">
                                    <History size={12} />
                                    <span>History</span>
                                </div>

                                {
                                    history.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-[var(--c-content)]/40 text-center italic">
                                            No recent chats
                                        </div>
                                    ) : (
                                        history.map((chat) => (
                                            <button
                                                key={chat.id}
                                                onClick={() => loadChat(chat.id)}
                                                className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-[var(--c-glass)]/20 transition-colors text-sm text-[var(--c-content)] truncate group"
                                            >
                                                <span className="group-hover:text-[var(--c-action)] transition-colors line-clamp-1">
                                                    {chat.title}
                                                </span>
                                            </button>
                                        ))
                                    )
                                }
                            </div>

                            {/* Clear History Button */}
                            {history.length > 0 && (
                                <div className="mt-2 px-2">
                                    <button
                                        onClick={async () => {
                                            if (!confirm('Opravdu chcete smazat celou historii chatu?')) return;
                                            try {
                                                const res = await apiFetch('/api/history', { method: 'DELETE' });
                                                const payload = await res.json() as ApiResponse<{ cleared: boolean }>;
                                                if (payload.success) {
                                                    setHistory([]);
                                                    setMessages([]);
                                                    setChatId(null);
                                                    setIsMenuOpen(false);
                                                }
                                            } catch (e) {
                                                console.error('Failed to clear history', e);
                                            }
                                        }}
                                        className="w-full text-xs text-red-400/70 hover:text-red-400 py-2 hover:bg-red-500/10 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={12} />
                                        Clear History
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Spacer/Title placeholder if needed */}
                    <div />

                    <div className="pointer-events-auto flex items-center justify-center scale-75 origin-right">
                        <ThemeSwitcher />
                    </div>
                </header>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto pt-28 pb-32 px-4 md:px-12 lg:px-24" ref={scrollRef} >
                    <div
                        className="max-w-3xl mx-auto space-y-8"
                        aria-live="polite"
                        aria-relevant="additions"
                    >
                        {messages.length === 0 ? (
                            <EmptyState onSuggestionSelect={handleSendMessage} />
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
                                    onCitationClick={onCitationSelect}
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
                            <ChatInput
                                onSend={handleSendMessage}
                                disabled={isLoading}
                                onStop={() => {
                                    if (abortControllerRef.current) {
                                        abortControllerRef.current.abort();
                                    }
                                }}
                                isGenerating={isLoading}
                            />

                        </form>
                        <div className="text-center mt-3 text-xs text-[var(--c-content)]/50 font-medium">
                            Liquid Glass LLM uses CSS Best Practices for premium aesthetics.
                        </div>
                    </div>
                </div>
            </div>

            <ManageFilesDialog open={isManageFilesOpen} onOpenChange={setIsManageFilesOpen} />

            {/* PDF Viewer Modal */}
            <PDFViewer
                key={`${pdfUrl ?? 'none'}:${initialPage}:${isPdfOpen ? 'open' : 'closed'}`}
                url={pdfUrl}
                isOpen={isPdfOpen}
                onClose={() => setIsPdfOpen(false)}
                title={pdfTitle}
                initialPage={initialPage}
                highlights={highlights}
                highlightContext={highlightContext}
            />
        </div>
    );
}

