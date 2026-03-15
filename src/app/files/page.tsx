'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PrivacyBadge } from '@/components/ui/PrivacyBadge';
import KnowledgeBaseWorkspace from '@/components/ingest/KnowledgeBaseWorkspace';

export default function FilesPage() {
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

                <KnowledgeBaseWorkspace />
            </div>
        </main>
    );
}
