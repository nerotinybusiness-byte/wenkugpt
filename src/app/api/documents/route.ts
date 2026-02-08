import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        console.log('API /api/documents: Fetching documents...');
        const allDocuments = await db.select()
            .from(documents)
            .orderBy(desc(documents.createdAt));

        console.log(`API /api/documents: Found ${allDocuments.length} documents`);

        return NextResponse.json({
            success: true,
            documents: allDocuments.map(doc => ({
                id: doc.id,
                filename: doc.filename,
                fileSize: doc.fileSize,
                pageCount: doc.pageCount,
                processingStatus: doc.processingStatus,
                createdAt: doc.createdAt,
            }))
        });
    } catch (error) {
        console.error('Error fetching documents:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch documents' },
            { status: 500 }
        );
    }
}
