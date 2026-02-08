'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploaderProps {
    onUploadComplete?: () => void;
}

interface FileWithStatus {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
    message?: string;
}

export default function FileUploader({ onUploadComplete }: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<FileWithStatus[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            addFiles(Array.from(e.target.files));
        }
        // Reset input to allow selecting same files again
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const addFiles = (newFiles: File[]) => {
        const validFiles: FileWithStatus[] = [];

        newFiles.forEach(file => {
            // 50MB Limit
            if (file.size > 50 * 1024 * 1024) {
                alert(`File ${file.name} is too large (max 50MB)`);
                return;
            }
            if (file.type !== 'application/pdf') {
                alert(`File ${file.name} is not a PDF`);
                return;
            }

            // Check if already exists
            if (files.some(f => f.file.name === file.name && f.file.size === file.size)) {
                return;
            }

            validFiles.push({
                id: Math.random().toString(36).substring(7),
                file,
                status: 'pending'
            });
        });

        setFiles(prev => [...prev, ...validFiles]);
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const uploadFile = async (fileWrapper: FileWithStatus) => {
        setFiles(prev => prev.map(f => f.id === fileWrapper.id ? { ...f, status: 'uploading' } : f));

        const formData = new FormData();
        formData.append('file', fileWrapper.file);
        formData.append('accessLevel', 'private');

        try {
            const response = await fetch('/api/ingest', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            setFiles(prev => prev.map(f => f.id === fileWrapper.id ? { ...f, status: 'success' } : f));
            if (onUploadComplete) onUploadComplete();

        } catch (error) {
            console.error('Upload error:', error);
            setFiles(prev => prev.map(f => f.id === fileWrapper.id ? {
                ...f,
                status: 'error',
                message: error instanceof Error ? error.message : 'Upload failed'
            } : f));
        }
    };

    const handleUploadAll = async () => {
        const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');

        // Upload sequentially to avoid overwhelming server limits/CPU
        for (const file of pendingFiles) {
            await uploadFile(file);
        }
    };

    const isUploading = files.some(f => f.status === 'uploading' || f.status === 'processing');
    const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'error').length;

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
                    accept=".pdf"
                    multiple // Enable multiple files
                    onChange={handleFileSelect}
                />

                <div
                    className="text-center select-none cursor-pointer flex flex-col items-center"
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                >
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Upload className={`w-6 h-6 text-white/40 ${isDragging ? 'text-emerald-500' : ''}`} />
                    </div>
                    <h3 className="text-base font-medium">Drop PDFs here</h3>
                    <p className="text-xs text-white/40 mt-1 uppercase tracking-wider">Max 50MB • Multiple Files</p>
                </div>
            </div>

            {/* File Queue */}
            {files.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {files.map(wrap => (
                        <div key={wrap.id} className="bg-white/5 rounded-lg p-3 flex items-center gap-3 border border-white/10">
                            <FileText className={`w-5 h-5 ${wrap.status === 'success' ? 'text-emerald-500' :
                                wrap.status === 'error' ? 'text-red-500' : 'text-emerald-500/50'
                                }`} />

                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <p className="text-sm font-medium truncate">{wrap.file.name}</p>
                                    <span className="text-xs text-white/30 ml-2">{(wrap.file.size / 1024 / 1024).toFixed(1)} MB</span>
                                </div>
                                <div className="text-xs">
                                    {wrap.status === 'pending' && <span className="text-white/40">Ready to upload</span>}
                                    {wrap.status === 'uploading' && <span className="text-blue-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>}
                                    {wrap.status === 'processing' && <span className="text-indigo-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Processing...</span>}
                                    {wrap.status === 'success' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Complete</span>}
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
                            Uploading {files.filter(f => f.status === 'uploading').length} files...
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
