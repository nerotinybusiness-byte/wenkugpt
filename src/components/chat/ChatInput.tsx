
import { Send } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    onStop?: () => void;
    isGenerating?: boolean;
}

export default function ChatInput({ onSend, disabled, onStop, isGenerating }: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [input, setInput] = useState('');

    const handleSubmit = () => {
        if (!input.trim() || disabled) return;
        onSend(input);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Auto-resize
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 192)}px`; // Max height 12rem (48 * 4)
        }
    }, [input]);

    return (
        <>
            <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={disabled && !isGenerating}
                className="w-full max-h-48 min-h-[56px] bg-transparent border-none resize-none px-4 py-[14px] text-base focus:outline-none placeholder-[var(--c-content)]/40 scrollbar-hide text-[var(--c-content)]"
                rows={1}
            />
            {isGenerating ? (
                <button
                    type="button"
                    onClick={onStop}
                    className="relative overflow-hidden shrink-0 w-12 h-12 m-1 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 border border-red-500/20"
                    title="Stop generating"
                >
                    <style jsx>{`
                        @keyframes ripple-red {
                            0% {
                                width: 12px;
                                height: 12px;
                                border-color: rgba(255, 255, 255, 0.8);
                                opacity: 1;
                            }
                            50% {
                                border-color: rgba(239, 68, 68, 0.8);
                            }
                            100% {
                                width: 48px;
                                height: 48px;
                                border-color: rgba(239, 68, 68, 0);
                                opacity: 0;
                            }
                        }
                    `}</style>
                    <span
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent box-border"
                        style={{ animation: 'ripple-red 2.5s ease-out infinite' }}
                    />
                    <span
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent box-border"
                        style={{ animation: 'ripple-red 2.5s ease-out infinite', animationDelay: '0.8s' }}
                    />
                    <span
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-transparent box-border"
                        style={{ animation: 'ripple-red 2.5s ease-out infinite', animationDelay: '1.6s' }}
                    />
                    <div className="relative w-3 h-3 bg-red-500 rounded-sm z-10 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!input.trim() || disabled}
                    className="shrink-0 w-12 h-12 m-1 rounded-full bg-[var(--c-action)] text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                    <Send size={20} />
                </button>
            )}
        </>
    );
}


