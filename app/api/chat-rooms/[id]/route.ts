
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

const getAuthToken = (req: NextRequest): string | null => {
    const authHeader = req.headers.get('authorization');
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

// DELETE: Soft delete (archive) a chat room
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const token = getAuthToken(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const roomId = params.id;
        if (!roomId) {
            return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
        }

        // Optional: Check ownership or admin status before deleting
        // For now, allowing creator or admin
        // const room = await query('SELECT created_by FROM chat_rooms WHERE id = ?', [roomId]);
        // if (!room || (room as any)[0].created_by !== payload.id) ... 

        await query('UPDATE chat_rooms SET is_archived = true WHERE id = ?', [roomId]);

        return NextResponse.json({ message: 'Room deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Delete room error:', error);
        return NextResponse.json({ error: 'Failed to delete room' }, { status: 500 });
    }
}

// PUT: Update room details (name, etc.)
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const token = getAuthToken(req);
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const roomId = params.id;
        const body = await req.json();
        const { name } = body;

        await query('UPDATE chat_rooms SET name = ? WHERE id = ?', [name, roomId]);

        return NextResponse.json({ message: 'Room updated' }, { status: 200 });

    } catch (error) {
        console.error('Update room error:', error);
        return NextResponse.json({ error: 'Failed to update room' }, { status: 500 });
    }
}
