
import { useState, useLayoutEffect, useRef } from 'react';

interface Size {
    width: number;
    height: number;
}

export function useElementSize<T extends HTMLElement = HTMLDivElement>(): [
    (node: T | null) => void,
    Size
] {
    const [size, setSize] = useState<Size>({
        width: 0,
        height: 0,
    });

    const ref = useRef<T | null>(null);

    const setRef = (node: T | null) => {
        ref.current = node;
    };

    useLayoutEffect(() => {
        if (!ref.current) return;

        const handleResize = (entries: ResizeObserverEntry[]) => {
            if (!Array.isArray(entries) || !entries.length) {
                return;
            }

            const entry = entries[0];
            let width: number;
            let height: number;

            if (entry.borderBoxSize?.length > 0) {
                width = entry.borderBoxSize[0].inlineSize;
                height = entry.borderBoxSize[0].blockSize;
            } else {
                width = entry.contentRect.width;
                height = entry.contentRect.height;
            }

            setSize({ width, height });
        };

        const observer = new ResizeObserver(handleResize);
        observer.observe(ref.current);

        return () => {
            observer.disconnect();
        };
    }, [ref.current]);

    return [setRef, size];
}
