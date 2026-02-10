export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
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
