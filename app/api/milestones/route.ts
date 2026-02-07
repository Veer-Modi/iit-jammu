import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

const getAuthToken = (req: NextRequest): string | null => {
  const authHeader = req.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

export async function GET(req: NextRequest) {
  try {
    const token = getAuthToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    const milestones = await query(
      `SELECT * FROM milestones 
       WHERE workspace_id = ? 
       ORDER BY due_date ASC`,
      [workspaceId]
    );

    return NextResponse.json(milestones, { status: 200 });
  } catch (error) {
    console.error('Fetch milestones error:', error);
    return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
  }
}
