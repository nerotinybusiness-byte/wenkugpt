'use client';

import { FileText } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import KnowledgeBaseWorkspace from '@/components/ingest/KnowledgeBaseWorkspace';

export interface ManageFilesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ManageFilesDialog({ open, onOpenChange }: ManageFilesDialogProps) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme !== 'light';

    const bgColor = isDark ? 'bg-[#1b1b1d]' : 'bg-[#ffffff]';
    const textColor = isDark ? 'text-[#e1e1e1]' : 'text-[#1b1b1d]';
    const subTextColor = isDark ? 'text-[#a1a1aa]' : 'text-[#52525b]';
    const borderColor = isDark ? 'border-[#27272a]' : 'border-[#e4e4e7]';
    const actionColor = isDark ? 'text-[#aaff00]' : 'text-[#65a30d]';
    const headerBorderColor = isDark ? 'border-white/10' : 'border-black/10';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={`w-[95vw] max-w-6xl h-[85vh] max-h-[90vh] p-0 border overflow-hidden backdrop-blur-xl shadow-2xl transition-colors duration-200 ${bgColor} ${textColor} ${borderColor}`}
            >
                <div className="h-full flex flex-col min-h-0">
                    <DialogHeader className={`px-6 py-4 border-b shrink-0 ${headerBorderColor}`}>
                        <DialogTitle className={`text-2xl font-bold flex items-center gap-2 ${actionColor}`}>
                            <FileText className="w-6 h-6" />
                            Knowledge Base
                        </DialogTitle>
                        <DialogDescription className={`text-sm ${subTextColor}`}>
                            Manage documents and ingestion
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-hidden">
                        <KnowledgeBaseWorkspace className="h-full md:grid-cols-[1fr_1.5fr]" />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
