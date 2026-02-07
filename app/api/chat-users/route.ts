import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const token = getAuthToken(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = verifyToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        // Fetch all active users for global open chat
        const members = await query(
            `SELECT id, first_name, last_name, email, avatar_url, role, is_active
       FROM users 
       WHERE is_active = TRUE AND id != ?
       ORDER BY first_name, last_name`,
            [payload.id]
        );

        return NextResponse.json(members);
    } catch (error) {
        console.error('Fetch chat users error:', error);
        return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }
}
