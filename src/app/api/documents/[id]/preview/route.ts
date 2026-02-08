import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chunks } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Document ID is required' },
                { status: 400 }
            );
        }

        // Fetch all chunks for the document, ordered by index
        const documentChunks = await db.select({
            content: chunks.content,
            pageNumber: chunks.pageNumber
        })
            .from(chunks)
            .where(eq(chunks.documentId, id))
            .orderBy(asc(chunks.chunkIndex));

        if (documentChunks.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No content found for this document' },
                { status: 404 }
            );
        }

        // Combine chunks into a single text
        // (Simple joining for now, could be smarter about pages)
        const fullText = documentChunks
            .map(chunk => `[Page ${chunk.pageNumber}]\n${chunk.content}`)
            .join('\n\n-------------------\n\n');

        return NextResponse.json({
            success: true,
            content: fullText
        });

    } catch (error) {
        console.error('Error fetching document preview:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch document preview' },
            { status: 500 }
        );
    }
}
