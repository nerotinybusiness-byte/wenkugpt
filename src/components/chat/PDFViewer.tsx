import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface PDFViewerProps {
    url: string | null;
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    highlights?: { page: number; bbox: BoundingBox }[];
    initialPage?: number;
}

export default function PDFViewer({ url, isOpen, onClose, title, highlights = [], initialPage = 1 }: PDFViewerProps) {
    const [numPages, setNumPages] = useState(0);
    const [pageNumber, setPageNumber] = useState(initialPage);
    const [scale, setScale] = useState(1.0);
    const [containerWidth, setContainerWidth] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    useEffect(() => {
        if (!scrollContainerRef.current || !isOpen) return;
        const resizeObserver = new ResizeObserver(([entry]) => {
            setContainerWidth(entry.contentRect.width);
        });
        resizeObserver.observe(scrollContainerRef.current);
        return () => resizeObserver.disconnect();
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') {
                setPageNumber((p) => Math.max(1, p - 1));
            }
            if (e.key === 'ArrowRight') {
                setPageNumber((p) => Math.min(numPages, p + 1));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, numPages, onClose]);

    const pageWidth = useMemo(() => {
        if (!containerWidth) return 860;
        return Math.max(320, Math.min(containerWidth - 96, 960));
    }, [containerWidth]);

    const currentPageHighlights = useMemo(
        () => highlights.filter((highlight) => highlight.page === pageNumber),
        [highlights, pageNumber],
    );

    const scrollToPage = (targetPage: number, behavior: ScrollBehavior = 'smooth') => {
        const container = scrollContainerRef.current;
        const pageElement = pageRefs.current.get(targetPage);
        if (!container || !pageElement) return;

        const offsetTop = pageElement.offsetTop - 24;
        container.scrollTo({ top: Math.max(0, offsetTop), behavior });
    };

    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => scrollToPage(pageNumber, 'auto'), 80);
        return () => clearTimeout(timer);
    }, [isOpen, pageNumber, numPages]);

    const goToPage = (targetPage: number) => {
        if (numPages === 0) return;
        const nextPage = Math.max(1, Math.min(numPages, targetPage));
        setPageNumber(nextPage);
        scrollToPage(nextPage);
    };

    const onDocumentLoadSuccess = ({ numPages: loadedPages }: { numPages: number }) => {
        setNumPages(loadedPages);
        setPageNumber((prev) => Math.max(1, Math.min(loadedPages, prev || initialPage)));
    };

    if (!isOpen || !url) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-300">
            <div
                className={`flex flex-col liquid-glass w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ease-out border border-white/20 ${isFullscreen ? 'fixed inset-0 max-w-none rounded-none' : 'max-h-[90vh]'}`}
            >
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl shrink-0 shadow-inner border border-red-500/20">
                            <svg className="w-6 h-6 drop-shadow-sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div className="flex flex-col truncate">
                            <h3
                                title={title || 'Document Viewer'}
                                className="font-bold text-lg text-[var(--c-content)] truncate tracking-tight"
                            >
                                {title || 'Document Viewer'}
                            </h3>
                            <span className="text-xs font-medium text-[var(--c-content)]/60 tracking-wide uppercase">
                                Page {pageNumber} <span className="opacity-40">/</span> {numPages || '--'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center p-1 rounded-full bg-black/5 dark:bg-white/5 border border-white/10 backdrop-blur-sm shadow-sm">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-white/20"
                                onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                            >
                                <ZoomOut size={16} />
                            </Button>
                            <span className="text-xs w-14 text-center font-bold tabular-nums text-[var(--c-content)]/80">
                                {Math.round(scale * 100)}%
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-white/20"
                                onClick={() => setScale((s) => Math.min(2.5, s + 0.1))}
                            >
                                <ZoomIn size={16} />
                            </Button>
                        </div>

                        <div className="h-6 w-px bg-current opacity-10 mx-1" />

                        <button
                            type="button"
                            onClick={() => setIsFullscreen((prev) => !prev)}
                            className="hidden md:flex h-9 w-9 items-center justify-center rounded-full border-0 bg-transparent hover:bg-white/20 text-[var(--c-content)]/80 transition-colors"
                        >
                            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="h-9 w-9 rounded-full border-0 bg-transparent flex items-center justify-center text-[var(--c-content)]/80 hover:bg-red-500/20 hover:text-red-600 transition-colors"
                            aria-label="Close document preview"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 relative bg-transparent overflow-hidden flex flex-col items-center">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                    <button
                        onClick={() => goToPage(pageNumber - 1)}
                        disabled={pageNumber <= 1}
                        className="absolute left-6 top-1/2 -translate-y-1/2 z-20 p-4 rounded-full bg-white/10 dark:bg-black/20 border border-white/20 text-[var(--c-content)] disabled:opacity-0 disabled:pointer-events-none transition-all duration-300 hover:bg-white/20 backdrop-blur-md shadow-lg"
                    >
                        <ChevronLeft size={28} />
                    </button>

                    <button
                        onClick={() => goToPage(pageNumber + 1)}
                        disabled={pageNumber >= numPages}
                        className="absolute right-6 top-1/2 -translate-y-1/2 z-20 p-4 rounded-full bg-white/10 dark:bg-black/20 border border-white/20 text-[var(--c-content)] disabled:opacity-0 disabled:pointer-events-none transition-all duration-300 hover:bg-white/20 backdrop-blur-md shadow-lg"
                    >
                        <ChevronRight size={28} />
                    </button>

                    <div ref={scrollContainerRef} className="h-full w-full overflow-y-auto overflow-x-auto custom-scrollbar px-4 md:px-8 py-6">
                        <Document
                            file={url}
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={
                                <div className="flex flex-col items-center justify-center gap-4 py-16">
                                    <Loader2 className="w-12 h-12 animate-spin text-[var(--c-action)]" />
                                    <p className="text-sm font-medium text-[var(--c-content)]/60 animate-pulse">Loading document...</p>
                                </div>
                            }
                            error={
                                <div className="flex flex-col items-center justify-center text-red-500 p-12 bg-red-500/5 rounded-2xl border border-red-500/10">
                                    <div className="p-4 bg-red-500/10 rounded-full mb-4">
                                        <X size={32} />
                                    </div>
                                    <p className="font-semibold text-lg">Failed to load PDF</p>
                                    <p className="text-sm opacity-70 mt-2 max-w-md text-center break-all">URL: {url}</p>
                                </div>
                            }
                            className="flex flex-col items-center gap-8"
                        >
                            {Array.from({ length: numPages }, (_, index) => {
                                const renderedPage = index + 1;
                                const pageHighlights = highlights.filter((highlight) => highlight.page === renderedPage);
                                return (
                                    <div
                                        key={renderedPage}
                                        ref={(el) => {
                                            if (el) pageRefs.current.set(renderedPage, el);
                                            else pageRefs.current.delete(renderedPage);
                                        }}
                                        className="relative group/page mx-auto"
                                    >
                                        <Page
                                            pageNumber={renderedPage}
                                            scale={scale}
                                            width={pageWidth}
                                            renderTextLayer={true}
                                            renderAnnotationLayer={true}
                                            className="shadow-2xl transition-transform duration-200 ease-out"
                                            loading={<div className="h-[800px] w-[600px] bg-white/5 animate-pulse rounded-lg" />}
                                        />
                                        <div className="absolute inset-0 shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] pointer-events-none rounded-sm" />
                                        {pageHighlights.map((highlight, idx) => (
                                            <div
                                                key={`${renderedPage}-${idx}`}
                                                className="absolute bg-[var(--c-action)]/20 border-2 border-[var(--c-action)] rounded-sm animate-pulse z-10 pointer-events-none mix-blend-multiply dark:mix-blend-screen"
                                                style={{
                                                    left: `${highlight.bbox.x * 100}%`,
                                                    top: `${highlight.bbox.y * 100}%`,
                                                    width: `${highlight.bbox.width * 100}%`,
                                                    height: `${highlight.bbox.height * 100}%`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                        </Document>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-white/10 bg-white/5 backdrop-blur-md flex justify-between items-center text-sm relative z-10">
                    <div className="flex items-center gap-3">
                        {currentPageHighlights.length > 0 && (
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--c-action)]/10 text-[var(--c-action)] text-xs font-bold border border-[var(--c-action)]/20 shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-[var(--c-action)] animate-pulse" />
                                {currentPageHighlights.length} highlights found
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 px-2 py-1 rounded-full border border-white/10">
                        <span className="text-[var(--c-content)]/60 font-medium pl-2">Go to page</span>
                        <input
                            type="number"
                            min={1}
                            max={Math.max(1, numPages)}
                            value={pageNumber}
                            onChange={(e) => goToPage(parseInt(e.target.value, 10) || 1)}
                            className="w-14 px-1 py-1 rounded-md bg-transparent text-center font-bold text-[var(--c-content)] focus:ring-0 outline-none border-b-2 border-transparent focus:border-[var(--c-action)] transition-colors no-spinner"
                        />
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .no-spinner::-webkit-inner-spin-button,
                .no-spinner::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
            `}</style>
        </div>
    );
}
