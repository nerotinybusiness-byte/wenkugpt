'use client';

import { useEffect, useState } from 'react';
import {
    AlertCircle,
    CheckCircle,
    CheckSquare,
    Eye,
    FileText,
    Loader2,
    RefreshCw,
    Search,
    Square,
    Trash2,
    X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/client-request';

interface DocumentItem {
    id: string;
    filename: string;
    fileSize: number;
    pageCount: number;
    processingStatus: 'completed' | 'processing' | 'failed';
    processingError?: string | null;
    templateProfileId?: string | null;
    templateMatched?: boolean;
    templateMatchScore?: number | null;
    templateBoilerplateChunks?: number;
    templateDetectionMode?: string | null;
    templateWarnings?: string[] | null;
    ocrRescueApplied?: boolean;
    ocrRescueEngine?: string | null;
    ocrRescueFallbackEngine?: string | null;
    ocrRescueChunksRecovered?: number;
    ocrRescueWarnings?: string[] | null;
    createdAt: string;
}

interface FileListProps {
    refreshTrigger?: number;
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
    error: string;
    code: string;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

const STORAGE_KEY_PREFIX_REGEX = /^[0-9a-f-]{36}_[0-9a-f-]{36}_(.+)$/i;

function toDisplayFilename(filename: string): string {
    const match = STORAGE_KEY_PREFIX_REGEX.exec(filename);
    return match?.[1] ?? filename;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
}

export default function FileList({ refreshTrigger = 0 }: FileListProps) {
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    const [previewDoc, setPreviewDoc] = useState<{ id: string; filename: string } | null>(null);
    const [previewContent, setPreviewContent] = useState('');
    const [loadingPreview, setLoadingPreview] = useState(false);

    const fetchDocuments = async () => {
        try {
            const response = await apiFetch('/api/documents', { cache: 'no-store' });
            const payload = await response.json() as ApiResponse<{ documents: DocumentItem[] }>;
            if (payload.success) {
                setDocuments(payload.data.documents);
            }
        } catch (error) {
            console.error('Failed to fetch documents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void fetchDocuments();
    }, [refreshTrigger]);

    useEffect(() => {
        let intervalTime: number | null = null;

        const hasProcessingDocs = documents.some((doc) => doc.processingStatus === 'processing');
        const isEmpty = documents.length === 0;

        if (hasProcessingDocs) {
            intervalTime = 3000;
        } else if (isEmpty) {
            intervalTime = 5000;
        }

        if (intervalTime) {
            const timer = setInterval(() => {
                void fetchDocuments();
            }, intervalTime);
            return () => clearInterval(timer);
        }

        return undefined;
    }, [documents]);

    const filteredDocuments = documents.filter((doc) => {
        const normalizedQuery = searchQuery.toLowerCase();
        const displayFilename = toDisplayFilename(doc.filename).toLowerCase();
        const rawFilename = doc.filename.toLowerCase();
        return displayFilename.includes(normalizedQuery) || rawFilename.includes(normalizedQuery);
    });

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredDocuments.length && filteredDocuments.length > 0) {
            setSelectedIds(new Set());
            return;
        }
        setSelectedIds(new Set(filteredDocuments.map((doc) => doc.id)));
    };

    const handleDelete = async (ids: string[]) => {
        if (!confirm(`Are you sure you want to delete ${ids.length} document(s)?`)) return;

        const nextDeleting = new Set(deletingIds);
        ids.forEach((id) => nextDeleting.add(id));
        setDeletingIds(nextDeleting);

        try {
            const deletionResults = await Promise.all(
                ids.map(async (id) => {
                    const response = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
                    const payload = await response.json() as ApiResponse<{ id: string }>;
                    return { id, ok: payload.success };
                }),
            );

            const failed = deletionResults.filter((row) => !row.ok).map((row) => row.id);
            const succeeded = deletionResults.filter((row) => row.ok).map((row) => row.id);

            setDocuments((prev) => prev.filter((doc) => !succeeded.includes(doc.id)));
            setSelectedIds((prev) => {
                const next = new Set(prev);
                succeeded.forEach((id) => next.delete(id));
                return next;
            });

            if (failed.length > 0) {
                alert(`Failed to delete ${failed.length} document(s).`);
            }
        } catch (error) {
            console.error('Error deleting documents:', error);
            alert('Error deleting some documents');
        } finally {
            setDeletingIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
        }
    };

    const openPreview = async (doc: DocumentItem) => {
        setPreviewDoc({ id: doc.id, filename: toDisplayFilename(doc.filename) });
        setLoadingPreview(true);
        setPreviewContent('');

        try {
            const response = await apiFetch(`/api/documents/${doc.id}/preview`);
            const payload = await response.json() as ApiResponse<{ content: string }>;
            if (payload.success) {
                setPreviewContent(payload.data.content);
            } else {
                setPreviewContent(`Error: ${payload.error || 'Failed to load content'}`);
            }
        } catch {
            setPreviewContent('Error loading preview. Please try again.');
        } finally {
            setLoadingPreview(false);
        }
    };

    const closePreview = () => {
        setPreviewDoc(null);
        setPreviewContent('');
    };

    const canUsePortal = typeof document !== 'undefined';

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-white/20" />
            </div>
        );
    }

    if (documents.length === 0 && !searchQuery) {
        return (
            <div className="text-center p-8 text-white/40">
                <p>No documents found</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2 mb-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleSelectAll}
                        disabled={isLoading || filteredDocuments.length === 0}
                        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {filteredDocuments.length > 0 && selectedIds.size === filteredDocuments.length ? (
                            <CheckSquare className="w-4 h-4 text-emerald-500" />
                        ) : (
                            <Square className="w-4 h-4" />
                        )}
                        Select All
                    </button>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                        Library ({filteredDocuments.length})
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 group-focus-within:text-white/80 transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-md py-1 px-2 pl-8 text-sm text-white focus:outline-none focus:border-white/20 focus:bg-white/10 w-32 transition-all focus:w-48 placeholder:text-white/20 h-8"
                        />
                    </div>

                    <button
                        onClick={() => {
                            void fetchDocuments();
                        }}
                        disabled={isLoading}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-white/40 hover:text-white disabled:opacity-50"
                        title="Refresh list"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>

                    {selectedIds.size > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                void handleDelete(Array.from(selectedIds));
                            }}
                            className="h-8 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 ml-2"
                        >
                            <Trash2 className="w-3 h-3 mr-1.5" />
                            Delete ({selectedIds.size})
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-2">
                {filteredDocuments.length === 0 && searchQuery && (
                    <div className="text-center p-8 text-white/40 border border-dashed border-white/10 rounded-lg">
                        <p>No documents match &quot;{searchQuery}&quot;</p>
                    </div>
                )}

                {filteredDocuments.map((doc) => {
                    const isSelected = selectedIds.has(doc.id);
                    const isDeleting = deletingIds.has(doc.id);
                    const previewDisabled = doc.processingStatus === 'failed';
                    const templateInfo = doc.templateMatched
                        ? `Template ${doc.templateProfileId || 'unknown'} (${Math.round((doc.templateMatchScore || 0) * 100)}%), filtered ${doc.templateBoilerplateChunks || 0}`
                        : null;
                    const warningInfo = Array.isArray(doc.templateWarnings) && doc.templateWarnings.length > 0
                        ? `Template warnings: ${doc.templateWarnings.join(', ')}`
                        : null;
                    const ocrInfo = doc.ocrRescueApplied
                        ? `OCR rescue recovered ${doc.ocrRescueChunksRecovered || 0} chunks`
                        : null;
                    const ocrEngineInfo = doc.ocrRescueEngine
                        ? `OCR engine: ${doc.ocrRescueEngine}${doc.ocrRescueFallbackEngine ? ` (fallback: ${doc.ocrRescueFallbackEngine})` : ''}`
                        : null;
                    const ocrWarningInfo = Array.isArray(doc.ocrRescueWarnings) && doc.ocrRescueWarnings.length > 0
                        ? `OCR warnings: ${doc.ocrRescueWarnings.join(', ')}`
                        : null;
                    const statusInfo = doc.processingStatus === 'failed' && doc.processingError
                        ? doc.processingError
                        : warningInfo || ocrWarningInfo;

                    return (
                        <div
                            key={doc.id}
                            className={`group flex items-center justify-between p-3 rounded-lg border transition-all ${isSelected
                                ? 'bg-emerald-500/5 border-emerald-500/30'
                                : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSelect(doc.id);
                                    }}
                                    className="cursor-pointer"
                                >
                                    {isSelected ? (
                                        <CheckSquare className="w-5 h-5 text-emerald-500" />
                                    ) : (
                                        <Square className="w-5 h-5 text-white/20 group-hover:text-white/40" />
                                    )}
                                </div>

                                <div className={`p-2 rounded-md ${doc.processingStatus === 'completed'
                                    ? 'bg-emerald-500/10'
                                    : doc.processingStatus === 'failed'
                                        ? 'bg-red-500/10'
                                        : 'bg-blue-500/10'}`}
                                >
                                    <FileText className={`w-4 h-4 ${doc.processingStatus === 'completed'
                                        ? 'text-emerald-500'
                                        : doc.processingStatus === 'failed'
                                            ? 'text-red-500'
                                            : 'text-blue-500'}`}
                                    />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate text-white/90">
                                        {toDisplayFilename(doc.filename)}
                                    </p>
                                    <div className="flex gap-3 text-xs text-white/40">
                                        <span>{formatBytes(doc.fileSize)}</span>
                                        <span>|</span>
                                        <span>{doc.pageCount} pages</span>
                                        <span>|</span>
                                        <span>{formatDate(doc.createdAt)}</span>
                                    </div>
                                    {templateInfo && (
                                        <p className="text-[11px] text-emerald-300/80 truncate">{templateInfo}</p>
                                    )}
                                    {ocrInfo && (
                                        <p className="text-[11px] text-cyan-300/80 truncate">{ocrInfo}</p>
                                    )}
                                    {ocrEngineInfo && (
                                        <p className="text-[11px] text-cyan-300/80 truncate">{ocrEngineInfo}</p>
                                    )}
                                    {statusInfo && (
                                        <p className={`text-[11px] truncate ${doc.processingStatus === 'failed'
                                            ? 'text-red-300/90'
                                            : 'text-amber-300/90'}`}
                                        >
                                            {statusInfo}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pl-4">
                                {doc.processingStatus === 'processing' && (
                                    <span className="flex items-center gap-1.5 text-xs text-blue-400">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        Processing
                                    </span>
                                )}
                                {doc.processingStatus === 'completed' && (
                                    <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                                        <CheckCircle className="w-3 h-3" />
                                        Ready
                                    </span>
                                )}
                                {doc.processingStatus === 'failed' && (
                                    <span className="flex items-center gap-1.5 text-xs text-red-400">
                                        <AlertCircle className="w-3 h-3" />
                                        Failed
                                    </span>
                                )}

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            void openPreview(doc);
                                        }}
                                        disabled={previewDisabled}
                                        className="p-2 hover:bg-white/10 rounded-md transition-all text-white/40 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white/40"
                                        title={previewDisabled ? 'Preview unavailable: no extracted text' : 'Preview document'}
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>

                                    <button
                                        onClick={() => {
                                            void handleDelete([doc.id]);
                                        }}
                                        disabled={isDeleting}
                                        className="p-2 hover:bg-white/10 rounded-md transition-all text-white/40 hover:text-red-400 disabled:opacity-50"
                                        title="Delete document"
                                    >
                                        {isDeleting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {previewDoc && canUsePortal && createPortal(
                <div
                    className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm pointer-events-auto"
                    onClick={closePreview}
                >
                    <div
                        className="w-full max-w-4xl h-[80vh] bg-[#0A0A0A] border border-white/10 rounded-xl flex flex-col shadow-2xl pointer-events-auto"
                        onClick={(event) => {
                            event.stopPropagation();
                        }}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-500" />
                                {previewDoc.filename}
                            </h3>
                            <button
                                onClick={closePreview}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-white/5 font-mono text-sm leading-relaxed custom-scrollbar">
                            {loadingPreview ? (
                                <div className="flex items-center justify-center h-full text-white/40 gap-3">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Loading content...
                                </div>
                            ) : (
                                <div className="whitespace-pre-wrap text-white/80">
                                    {previewContent}
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/10 flex justify-end">
                            <Button variant="secondary" onClick={closePreview}>
                                Close Preview
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}

