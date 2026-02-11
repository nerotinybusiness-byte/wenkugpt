'use client';

import { useState } from 'react';
import FileUploader from '@/components/ingest/FileUploader';
import FileList from '@/components/ingest/FileList';
import { cn } from '@/lib/utils';

interface KnowledgeBaseWorkspaceProps {
    className?: string;
    leftPaneClassName?: string;
    rightPaneClassName?: string;
}

export default function KnowledgeBaseWorkspace({
    className,
    leftPaneClassName,
    rightPaneClassName,
}: KnowledgeBaseWorkspaceProps) {
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleUploadComplete = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    return (
        <div className={cn('flex-1 h-full min-h-0 grid md:grid-cols-[1fr_1.5fr] gap-0 divide-x divide-white/10', className)}>
            <div className={cn('min-h-0 p-8 bg-white/[0.02]', leftPaneClassName)}>
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

            <div className={cn('min-h-0 flex flex-col', rightPaneClassName)}>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 custom-scrollbar-wide">
                    <FileList refreshTrigger={refreshTrigger} />
                </div>
            </div>
        </div>
    );
}
