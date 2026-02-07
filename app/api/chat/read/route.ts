
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const token = getAuthToken(req);
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const body = await req.json();
        const { room_id } = body;

        if (!room_id) return NextResponse.json({ error: 'Room ID required' }, { status: 400 });

        await query(
            `INSERT INTO chat_notifications (user_id, room_id, unread_count)
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE unread_count = 0, last_read_at = CURRENT_TIMESTAMP`,
            [payload.id, room_id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Read receipt error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
