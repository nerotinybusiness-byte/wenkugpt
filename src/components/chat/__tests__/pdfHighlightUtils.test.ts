import { describe, expect, it } from 'vitest';
import {
    getEnvelopeBox,
    isCoarseHighlightSet,
    mergeNearbyBoxes,
} from '../pdfHighlightUtils';

describe('isCoarseHighlightSet', () => {
    it('flags a single very large box as coarse', () => {
        expect(isCoarseHighlightSet([
            { x: 0.1, y: 0.1, width: 0.85, height: 0.5 },
        ])).toBe(true);
    });

    it('does not flag a small focused box as coarse', () => {
        expect(isCoarseHighlightSet([
            { x: 0.1, y: 0.2, width: 0.25, height: 0.05 },
        ])).toBe(false);
    });

    it('flags large multi-box coverage as coarse', () => {
        const boxes = [
            { x: 0.05, y: 0.10, width: 0.70, height: 0.08 },
            { x: 0.08, y: 0.25, width: 0.72, height: 0.08 },
            { x: 0.10, y: 0.40, width: 0.70, height: 0.08 },
            { x: 0.12, y: 0.55, width: 0.68, height: 0.08 },
            { x: 0.15, y: 0.70, width: 0.60, height: 0.08 },
        ];
        expect(isCoarseHighlightSet(boxes)).toBe(true);
    });
});

describe('mergeNearbyBoxes', () => {
    it('merges touching boxes on the same row', () => {
        const merged = mergeNearbyBoxes([
            { x: 0.10, y: 0.20, width: 0.10, height: 0.03 },
            { x: 0.205, y: 0.201, width: 0.12, height: 0.03 },
        ]);
        expect(merged.length).toBe(1);
        expect(merged[0].x).toBeCloseTo(0.10);
        expect(merged[0].width).toBeCloseTo(0.225);
    });
});

describe('getEnvelopeBox', () => {
    it('returns envelope for multiple boxes', () => {
        const envelope = getEnvelopeBox([
            { x: 0.15, y: 0.25, width: 0.20, height: 0.10 },
            { x: 0.50, y: 0.40, width: 0.20, height: 0.15 },
        ]);
        expect(envelope).not.toBeNull();
        expect(envelope?.x).toBeCloseTo(0.15);
        expect(envelope?.y).toBeCloseTo(0.25);
        expect(envelope?.width).toBeCloseTo(0.55);
        expect(envelope?.height).toBeCloseTo(0.30);
    });
});
