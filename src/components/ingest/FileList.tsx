'use client';

import { useState, useEffect } from 'react';
import { FileText, Trash2, CheckCircle, Loader2, AlertCircle, Eye, X, CheckSquare, Square, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Document {
    id: string;
    filename: string;
    fileSize: number;
    pageCount: number;
    processingStatus: 'completed' | 'processing' | 'failed';
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

export default function FileList({ refreshTrigger = 0 }: FileListProps) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Preview state
    const [previewDoc, setPreviewDoc] = useState<{ id: string; filename: string } | null>(null);
    const [previewContent, setPreviewContent] = useState<string>('');
    const [loadingPreview, setLoadingPreview] = useState(false);

    const fetchDocuments = async () => {
        try {
            const response = await fetch('/api/documents', { cache: 'no-store' });
            const payload = await response.json() as ApiResponse<{ documents: Document[] }>;
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
        fetchDocuments();
    }, [refreshTrigger]);

    // Smart Polling Logic
    useEffect(() => {
        let intervalTime: number | null = null;

        const hasProcessingDocs = documents.some(doc => doc.processingStatus === 'processing');
        const isEmpty = documents.length === 0;

        if (hasProcessingDocs) {
            // Processing: Poll fast (3s) to show progress
            intervalTime = 3000;
        } else if (isEmpty) {
            // Empty: Poll medium (5s) to recover from potential server startup issues
            intervalTime = 5000;
        }
        // If has documents and none are processing -> Don't poll (stable state)

        if (intervalTime) {
            const timer = setInterval(fetchDocuments, intervalTime);
            return () => clearInterval(timer);
        }
    }, [documents]);

    const filteredDocuments = documents.filter(doc =>
        doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredDocuments.length && filteredDocuments.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredDocuments.map(d => d.id)));
        }
    };

    const handleDelete = async (ids: string[]) => {
        if (!confirm(`Are you sure you want to delete ${ids.length} document(s)?`)) return;

        const newDeletingIds = new Set(deletingIds);
        ids.forEach(id => newDeletingIds.add(id));
        setDeletingIds(newDeletingIds);

        try {
            const deletionResults = await Promise.all(
                ids.map(async (id) => {
                    const response = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
                    const payload = await response.json() as ApiResponse<{ id: string }>;
                    return { id, ok: payload.success };
                })
            );

            const failed = deletionResults.filter((r) => !r.ok).map((r) => r.id);
            const succeeded = deletionResults.filter((r) => r.ok).map((r) => r.id);

            // Remove from local state
            setDocuments(prev => prev.filter(doc => !succeeded.includes(doc.id)));
            setSelectedIds(prev => {
                const next = new Set(prev);
                succeeded.forEach(id => next.delete(id));
                return next;
            });

            if (failed.length > 0) {
                alert(`Failed to delete ${failed.length} document(s).`);
            }
        } catch (error) {
            console.error('Error deleting documents:', error);
            alert('Error deleting some documents');
        } finally {
            // Clear deleting status
            setDeletingIds(prev => {
                const next = new Set(prev);
                ids.forEach(id => next.delete(id));
                return next;
            });
        }
    };

    const openPreview = async (doc: Document) => {
        setPreviewDoc({ id: doc.id, filename: doc.filename });
        setLoadingPreview(true);
        setPreviewContent('');

        try {
            const response = await fetch(`/api/documents/${doc.id}/preview`);
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

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

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
            {/* Header / Actions */}
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
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Library ({filteredDocuments.length})</h3>
                </div>

                <div className="flex items-center gap-2">
                    {/* Search Bar */}
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
                        onClick={() => fetchDocuments()}
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
                            onClick={() => handleDelete(Array.from(selectedIds))}
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

                    return (
                        <div
                            key={doc.id}
                            className={`group flex items-center justify-between p-3 rounded-lg border transition-all ${isSelected
                                ? 'bg-emerald-500/5 border-emerald-500/30'
                                : 'bg-white/5 border-white/5 hover:border-white/10'
                                }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    onClick={(e) => { e.stopPropagation(); toggleSelect(doc.id); }}
                                    className="cursor-pointer"
                                >
                                    {isSelected ? (
                                        <CheckSquare className="w-5 h-5 text-emerald-500" />
                                    ) : (
                                        <Square className="w-5 h-5 text-white/20 group-hover:text-white/40" />
                                    )}
                                </div>

                                <div className={`p-2 rounded-md ${doc.processingStatus === 'completed' ? 'bg-emerald-500/10' :
                                    doc.processingStatus === 'failed' ? 'bg-red-500/10' : 'bg-blue-500/10'
                                    }`}>
                                    <FileText className={`w-4 h-4 ${doc.processingStatus === 'completed' ? 'text-emerald-500' :
                                        doc.processingStatus === 'failed' ? 'text-red-500' : 'text-blue-500'
                                        }`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium truncate text-white/90">{doc.filename}</p>
                                    <div className="flex gap-3 text-xs text-white/40">
                                        <span>{formatBytes(doc.fileSize)}</span>
                                        <span>•</span>
                                        <span>{doc.pageCount} pages</span>
                                        <span>•</span>
                                        <span>{formatDate(doc.createdAt)}</span>
                                    </div>
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
                                        onClick={() => openPreview(doc)}
                                        className="p-2 hover:bg-white/10 rounded-md transition-all text-white/40 hover:text-white"
                                        title="Preview document"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>

                                    <button
                                        onClick={() => handleDelete([doc.id])}
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

            {/* Preview Modal Overlay */}
            {previewDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-4xl h-[80vh] bg-[#0A0A0A] border border-white/10 rounded-xl flex flex-col shadow-2xl">
                        {/* Modal Header */}
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

                        {/* Modal Content */}
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

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white/10 flex justify-end">
                            <Button variant="secondary" onClick={closePreview}>
                                Close Preview
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


