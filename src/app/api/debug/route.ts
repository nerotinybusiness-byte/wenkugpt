
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents, chunks } from '@/lib/db/schema';
import { eq, ilike } from 'drizzle-orm';

export async function GET(req: NextRequest) {
    try {
        const docs = await db.select().from(documents).limit(20);

        const results = await Promise.all(docs.map(async (doc) => {
            const docChunks = await db.select().from(chunks).where(eq(chunks.documentId, doc.id));
            return {
                ...doc,
                chunkCount: docChunks.length,
                firstChunk: docChunks[0]?.content.slice(0, 50)
            };
        }));

        return NextResponse.json({ success: true, documents: results });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
