import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

const getAuthToken = (req: NextRequest): string | null => {
    const authHeader = req.headers.get('authorization');
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

// GET - Fetch all active users (for dropdowns)
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

        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get('workspaceId');

        let users;

        if (workspaceId) {
            // Fetch users in specific workspace
            users = await query(
                `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.role, wm.role as workspace_role
         FROM users u
         INNER JOIN workspace_members wm ON u.id = wm.user_id
         WHERE wm.workspace_id = ? AND u.is_active = TRUE AND wm.is_active = TRUE
         ORDER BY u.first_name, u.last_name`,
                [workspaceId]
            );
        } else {
            // Fetch all active users (for admin purposes)
            users = await query(
                `SELECT id, email, first_name, last_name, avatar_url, role
         FROM users
         WHERE is_active = TRUE
         ORDER BY first_name, last_name`
            );
        }

        return NextResponse.json(users || [], { status: 200 });
    } catch (error) {
        console.error('Fetch users error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}
