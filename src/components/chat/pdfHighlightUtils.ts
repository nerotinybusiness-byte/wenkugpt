export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface HighlightRegion {
    id: string;
    boxes: BoundingBox[];
    envelope: BoundingBox;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

function getBoxArea(box: BoundingBox): number {
    return Math.max(0, box.width) * Math.max(0, box.height);
}

export function getEnvelopeBox(boxes: BoundingBox[]): BoundingBox | null {
    if (boxes.length === 0) return null;

    let minX = boxes[0].x;
    let minY = boxes[0].y;
    let maxX = boxes[0].x + boxes[0].width;
    let maxY = boxes[0].y + boxes[0].height;

    for (const box of boxes.slice(1)) {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
    }

    return {
        x: minX,
        y: minY,
        width: Math.max(0, maxX - minX),
        height: Math.max(0, maxY - minY),
    };
}

export function getTotalArea(boxes: BoundingBox[]): number {
    return boxes.reduce((sum, box) => sum + getBoxArea(box), 0);
}

export function expandBoundingBox(box: BoundingBox, margin: number): BoundingBox {
    const left = clamp01(box.x - margin);
    const top = clamp01(box.y - margin);
    const right = clamp01(box.x + box.width + margin);
    const bottom = clamp01(box.y + box.height + margin);

    return {
        x: left,
        y: top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
    };
}

export function getIntersectionArea(a: BoundingBox, b: BoundingBox): number {
    const left = Math.max(a.x, b.x);
    const top = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    if (right <= left || bottom <= top) return 0;
    return (right - left) * (bottom - top);
}

function boxesAreNear(
    a: BoundingBox,
    b: BoundingBox,
    verticalGap: number,
    horizontalProximity: number,
): boolean {
    const verticalNear = a.y <= b.y + b.height + verticalGap
        && b.y <= a.y + a.height + verticalGap;
    const horizontalNear = a.x <= b.x + b.width + horizontalProximity
        && b.x <= a.x + a.width + horizontalProximity;
    return verticalNear && horizontalNear;
}

export function clusterHighlightRegions(
    boxes: BoundingBox[],
    verticalGap: number = 0.045,
    horizontalProximity: number = 0.08,
): HighlightRegion[] {
    if (boxes.length === 0) return [];

    const sorted = [...boxes].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const regions: Array<{ boxes: BoundingBox[]; envelope: BoundingBox }> = [];

    for (const box of sorted) {
        let targetRegion: { boxes: BoundingBox[]; envelope: BoundingBox } | null = null;
        for (const region of regions) {
            if (boxesAreNear(box, region.envelope, verticalGap, horizontalProximity)) {
                targetRegion = region;
                break;
            }
        }

        if (!targetRegion) {
            regions.push({
                boxes: [{ ...box }],
                envelope: { ...box },
            });
            continue;
        }

        targetRegion.boxes.push({ ...box });
        const envelope = getEnvelopeBox(targetRegion.boxes);
        targetRegion.envelope = envelope ? envelope : targetRegion.envelope;
    }

    return regions
        .sort((a, b) => (a.envelope.y - b.envelope.y) || (a.envelope.x - b.envelope.x))
        .map((region, index) => ({
            id: `r${index + 1}`,
            boxes: region.boxes,
            envelope: region.envelope,
        }));
}

export function buildHighlightSignature(boxes: BoundingBox[]): string {
    if (boxes.length === 0) return 'empty';
    const serialized = [...boxes]
        .sort((a, b) => (a.y - b.y) || (a.x - b.x))
        .map((box) => [
            box.x.toFixed(3),
            box.y.toFixed(3),
            box.width.toFixed(3),
            box.height.toFixed(3),
        ].join(','))
        .join('|');

    let hash = 2166136261;
    for (let i = 0; i < serialized.length; i += 1) {
        hash ^= serialized.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
}

export function isCoarseHighlightSet(boxes: BoundingBox[]): boolean {
    if (boxes.length === 0) return false;

    if (boxes.length === 1) {
        const box = boxes[0];
        const area = getBoxArea(box);
        return area > 0.2 || box.height > 0.25 || box.width > 0.8;
    }

    if (boxes.length > 12) return true;

    const envelope = getEnvelopeBox(boxes);
    if (!envelope) return false;

    const envelopeArea = getBoxArea(envelope);
    const totalArea = getTotalArea(boxes);
    return envelopeArea > 0.35 || totalArea > 0.45;
}

export function mergeNearbyBoxes(boxes: BoundingBox[]): BoundingBox[] {
    if (boxes.length <= 1) return boxes;

    const sorted = [...boxes].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const merged: BoundingBox[] = [];

    for (const box of sorted) {
        const last = merged[merged.length - 1];
        if (!last) {
            merged.push({ ...box });
            continue;
        }

        const similarRow = Math.abs(last.y - box.y) < 0.02 && Math.abs(last.height - box.height) < 0.03;
        const touching = box.x <= last.x + last.width + 0.03;
        if (similarRow && touching) {
            const minX = Math.min(last.x, box.x);
            const maxX = Math.max(last.x + last.width, box.x + box.width);
            const minY = Math.min(last.y, box.y);
            const maxY = Math.max(last.y + last.height, box.y + box.height);
            last.x = minX;
            last.y = minY;
            last.width = maxX - minX;
            last.height = maxY - minY;
            continue;
        }

        merged.push({ ...box });
    }

    return merged;
}
