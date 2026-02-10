'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/client-request';

interface FileUploaderProps {
    onUploadComplete?: () => void;
}

interface FileWithStatus {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
    message?: string;
}

interface TemplateUploadDiagnostics {
    profileId: string | null;
    matched: boolean;
    matchScore: number | null;
    detectionMode: 'text' | 'ocr' | 'hybrid' | 'none';
    boilerplateChunks: number;
    warnings: string[];
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
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

function toUserFriendlyUploadMessage(rawMessage: string): string {
    const normalized = rawMessage.toLowerCase();

    if (
        normalized.includes('dommatrix') ||
        normalized.includes('pdf runtime polyfill') ||
        normalized.includes('@napi-rs/canvas')
    ) {
        return 'PDF parser na serveru neni spravne nakonfigurovany (DOMMatrix). Nahraj TXT nebo to zkus po nasazeni opravy serveru.';
    }

    if (normalized.includes('x-user-email') || normalized.includes('missing client identity')) {
        return 'Chybi identita uzivatele pro API. Nastav NEXT_PUBLIC_DEFAULT_USER_EMAIL nebo localStorage klic x-user-email.';
    }

    return rawMessage;
}

function isAllowedFile(file: File): boolean {
    if (file.type === 'application/pdf' || file.type === 'text/plain') return true;
    const lower = file.name.toLowerCase();
    return lower.endsWith('.pdf') || lower.endsWith('.txt');
}

export default function FileUploader({ onUploadComplete }: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<FileWithStatus[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const addFiles = useCallback((newFiles: File[]) => {
        setFiles((prev) => {
            const seen = new Set(prev.map((f) => `${f.file.name}:${f.file.size}`));
            const validFiles: FileWithStatus[] = [];

            for (const file of newFiles) {
                if (file.size > 50 * 1024 * 1024) {
                    alert(`File ${file.name} is too large (max 50MB)`);
                    continue;
                }
                if (!isAllowedFile(file)) {
                    alert(`File ${file.name} is not a supported type (PDF/TXT)`);
                    continue;
                }

                const fingerprint = `${file.name}:${file.size}`;
                if (seen.has(fingerprint)) {
                    continue;
                }

                seen.add(fingerprint);
                validFiles.push({
                    id: Math.random().toString(36).substring(7),
                    file,
                    status: 'pending',
                });
            }

            return [...prev, ...validFiles];
        });
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.length > 0) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    }, [addFiles]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            addFiles(Array.from(e.target.files));
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [addFiles]);

    const removeFile = (id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const uploadFile = async (fileWrapper: FileWithStatus) => {
        setFiles((prev) => prev.map((f) => (f.id === fileWrapper.id ? { ...f, status: 'uploading' } : f)));

        const formData = new FormData();
        formData.append('file', fileWrapper.file);
        formData.append('options', JSON.stringify({
            accessLevel: 'private',
            skipEmbedding: false,
        }));

        try {
            const response = await apiFetch('/api/ingest', {
                method: 'POST',
                body: formData,
            });
            const raw = await response.text();
            let payload: ApiResponse<{ documentId: string; template?: TemplateUploadDiagnostics }> | null = null;

            if (raw) {
                try {
                    payload = JSON.parse(raw) as ApiResponse<{ documentId: string; template?: TemplateUploadDiagnostics }>;
                } catch {
                    payload = null;
                }
            }

            if (!response.ok) {
                throw new Error(payload?.error || `Upload failed (${response.status})`);
            }
            if (!payload?.success) {
                throw new Error(payload?.error || 'Upload failed');
            }

            const templateDiagnostics = payload.data.template;
            const templateWarnings = templateDiagnostics?.warnings || [];
            const successMessage = templateWarnings.length > 0
                ? `Complete (template warnings: ${templateWarnings.join(', ')})`
                : templateDiagnostics?.matched
                    ? `Complete (template: ${templateDiagnostics.profileId || 'matched'}, filtered ${templateDiagnostics.boilerplateChunks})`
                    : 'Complete';

            setFiles((prev) => prev.map((f) => (f.id === fileWrapper.id ? { ...f, status: 'success', message: successMessage } : f)));
            if (onUploadComplete) onUploadComplete();
        } catch (error) {
            const rawMessage = error instanceof Error ? error.message : 'Upload failed';
            const userMessage = toUserFriendlyUploadMessage(rawMessage);

            setFiles((prev) => prev.map((f) => {
                if (f.id !== fileWrapper.id) return f;
                return {
                    ...f,
                    status: 'error',
                    message: userMessage,
                };
            }));
        }
    };

    const handleUploadAll = async () => {
        const pendingFiles = files.filter((f) => f.status === 'pending' || f.status === 'error');
        for (const file of pendingFiles) {
            await uploadFile(file);
        }
    };

    const isUploading = files.some((f) => f.status === 'uploading' || f.status === 'processing');
    const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'error').length;

    return (
        <div className="w-full space-y-4">
            <div
                className={`
                    relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300
                    flex flex-col items-center justify-center p-8 min-h-[160px]
                    ${isDragging
                        ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]'
                        : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                    }
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.txt,text/plain,application/pdf"
                    multiple
                    onChange={handleFileSelect}
                />

                <div
                    className="text-center select-none cursor-pointer flex flex-col items-center"
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                        <Upload className={`w-6 h-6 text-white/40 ${isDragging ? 'text-emerald-500' : ''}`} />
                    </div>
                    <h3 className="text-base font-medium">Drop PDF/TXT files here</h3>
                    <p className="text-xs text-white/40 mt-1 uppercase tracking-wider">Max 50MB - Multiple Files</p>
                </div>
            </div>

            {files.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {files.map((wrap) => (
                        <div key={wrap.id} className="bg-white/5 rounded-lg p-3 flex items-center gap-3 border border-white/10">
                            <FileText
                                className={`w-5 h-5 ${wrap.status === 'success'
                                    ? 'text-emerald-500'
                                    : wrap.status === 'error'
                                        ? 'text-red-500'
                                        : 'text-emerald-500/50'
                                    }`}
                            />

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <p className="text-sm font-medium truncate">{wrap.file.name}</p>
                                    <span className="text-xs text-white/30 ml-2">{(wrap.file.size / 1024 / 1024).toFixed(1)} MB</span>
                                </div>
                                <div className="text-xs">
                                    {wrap.status === 'pending' && <span className="text-white/40">Ready to upload</span>}
                                    {wrap.status === 'uploading' && <span className="text-blue-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>}
                                    {wrap.status === 'processing' && <span className="text-indigo-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processing...</span>}
                                    {wrap.status === 'success' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {wrap.message || 'Complete'}</span>}
                                    {wrap.status === 'error' && <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {wrap.message || 'Error'}</span>}
                                </div>
                            </div>

                            {wrap.status !== 'uploading' && wrap.status !== 'processing' && (
                                <button
                                    onClick={() => removeFile(wrap.id)}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/30 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {files.length > 0 && pendingCount > 0 && (
                <Button
                    onClick={handleUploadAll}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading {files.filter((f) => f.status === 'uploading').length} files...
                        </>
                    ) : (
                        <>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload {pendingCount} Files
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}
