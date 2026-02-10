export { };
import dotenv from 'dotenv';
import path from 'path';
import { isNotNull, or } from 'drizzle-orm';

interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Load env
const envPath = path.join(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

function boxArea(box: BoundingBox): number {
    return Math.max(0, box.width) * Math.max(0, box.height);
}

function getEnvelope(boxes: BoundingBox[]): BoundingBox | null {
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

function isCoarse(boundingBox: BoundingBox | null, highlightBoxes: BoundingBox[]): boolean {
    if (boundingBox && (boxArea(boundingBox) > 0.35 || boundingBox.width > 0.8 || boundingBox.height > 0.35)) {
        return true;
    }

    if (highlightBoxes.length > 12) return true;
    if (highlightBoxes.length === 0) return false;

    const envelope = getEnvelope(highlightBoxes);
    if (!envelope) return false;

    const envelopeArea = boxArea(envelope);
    const totalArea = highlightBoxes.reduce((sum, box) => sum + boxArea(box), 0);
    return envelopeArea > 0.35 || totalArea > 0.45;
}

async function main() {
    const { db } = await import('../src/lib/db/index');
    const { chunks } = await import('../src/lib/db/schema');

    console.log('Checking bounding/highlight boxes...');

    const sampleChunks = await db.select().from(chunks)
        .where(or(
            isNotNull(chunks.boundingBox),
            isNotNull(chunks.highlightBoxes),
        ))
        .limit(20);

    if (sampleChunks.length === 0) {
        console.log('No chunks found with bounding/highlight data.');
        return;
    }

    console.log(`Found ${sampleChunks.length} sample chunks with metadata:`);
    sampleChunks.forEach((chunk) => {
        const bbox = chunk.boundingBox as BoundingBox | null;
        const highlightBoxes = Array.isArray(chunk.highlightBoxes)
            ? chunk.highlightBoxes as BoundingBox[]
            : [];
        const envelope = getEnvelope(highlightBoxes);
        const totalArea = highlightBoxes.reduce((sum, box) => sum + boxArea(box), 0);
        const coarse = isCoarse(bbox, highlightBoxes);

        console.log(`- Chunk ${chunk.id.slice(0, 8)} | p.${chunk.pageNumber} | coarse=${coarse}`);
        console.log(`  bbox: ${JSON.stringify(bbox)}`);
        console.log(`  highlightBoxes: count=${highlightBoxes.length} totalArea=${totalArea.toFixed(3)} envelope=${envelope ? JSON.stringify(envelope) : 'null'}`);
    });
}

main().catch(console.error).finally(() => process.exit());
