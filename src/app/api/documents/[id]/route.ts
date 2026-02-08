import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(
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

        // Delete from database (cascade handles related chunks)
        const deleted = await db.delete(documents)
            .where(eq(documents.id, id))
            .returning({ id: documents.id });

        if (deleted.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Document not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Document deleted successfully',
            id: deleted[0].id
        });

    } catch (error) {
        console.error('Error deleting document:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete document' },
            { status: 500 }
        );
    }
}
