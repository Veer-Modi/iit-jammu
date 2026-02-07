
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthToken, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const token = getAuthToken(req);
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const payload = verifyToken(token);
        if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const sql = `
      SELECT COALESCE(SUM(unread_count), 0) as total_unread
      FROM chat_notifications
      WHERE user_id = ?
    `;

        const result = await query(sql, [payload.id]);
        const totalUnread = (result as any[])[0]?.total_unread || 0;

        return NextResponse.json({ total_unread: Number(totalUnread) });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
