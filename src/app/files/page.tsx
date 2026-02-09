'use client';

import { useState } from 'react';

import FileUploader from '@/components/ingest/FileUploader';
import FileList from '@/components/ingest/FileList';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PrivacyBadge } from '@/components/ui/PrivacyBadge';

export default function FilesPage() {
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleUploadComplete = () => {
        // Trigger a refresh of the file list
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <main className="min-h-screen bg-black text-white p-4 md:p-8 flex items-center justify-center">
            {/* Background Ambience */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-6xl glass rounded-2xl overflow-hidden min-h-[85vh] flex flex-col relative z-10 animate-in fade-in duration-500">

                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/60 hover:text-white"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">Knowledge Base</h1>
                            <p className="text-sm text-white/40">Manage documents and ingestion</p>
                        </div>
                    </div>
                    <PrivacyBadge />
                </div>

                {/* Content - Split View */}
                <div className="flex-1 grid md:grid-cols-[1fr_1.5fr] gap-0 divide-x divide-white/10">

                    {/* Left Panel: Upload */}
                    <div className="p-8 bg-white/[0.02]">
                        <div className="max-w-md mx-auto space-y-8">
                            <div>
                                <h2 className="text-lg font-medium mb-2">Upload Documents</h2>
                                <p className="text-sm text-white/50">
                                    Add PDF or TXT files to your knowledge base. They will be automatically parsed, chunked, and embedded for search.
                                </p>
                            </div>

                            <FileUploader onUploadComplete={handleUploadComplete} />

                            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-400/80 leading-relaxed">
                                <strong className="block mb-1 text-emerald-400">Security Note</strong>
                                All uploads are processed in EU-compliant regions (Frankfurt) and stored with row-level security.
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: List */}
                    <div className="flex flex-col">
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                            <FileList refreshTrigger={refreshTrigger} />
                        </div>
                    </div>

                </div>
            </div>
        </main>
    );
}
