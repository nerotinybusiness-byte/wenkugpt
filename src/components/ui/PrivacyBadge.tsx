import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const PrivacyBadge = () => {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                EU Data Residency
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
        </div>
    );
};
