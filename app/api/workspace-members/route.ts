import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendWorkspaceCreated } from '@/lib/email';

const getAuthToken = (req: NextRequest): string | null => {
  const authHeader = req.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

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
    // We allow fetching without workspaceId implied for "Global Team" if needed, 
    // but schema expects simple handling.

    // Check Permission: 
    // If Global Admin -> Allow
    // If Workspace Admin -> Allow
    // Else -> Strict Check

    let isGlobalAdmin = payload.role === 'admin';
    let isWorkspaceAdmin = false;

    if (workspaceId) {
      const memberCheck = await query(
        `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND is_active = true`,
        [workspaceId, payload.id]
      );
      if ((memberCheck as any[]).length > 0) {
        const role = (memberCheck as any[])[0].role;
        if (role === 'admin' || role === 'manager') isWorkspaceAdmin = true;
      }
    }

    if (!isGlobalAdmin && !isWorkspaceAdmin) {
      // If strict workspace check failed and not global admin
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch Users with Stats
    // We fetch ALL users who are effectively part of the "Team" (employees, managers, admins)
    // We LEFT JOIN workspace_members to get equity/title IF they are in this workspace
    // We Subquery tasks for stats

    const safeWorkspaceId = workspaceId || 0;
    // When workspaceId provided: return only users IN that workspace (for project member dropdown, etc.)
    // Simplified: Fetch ALL employees from users table
    // Left join with workspace_members to get workspace-specific details if they exist
    const sql = `
      SELECT 
        u.id as user_id,
        u.id,
        u.first_name, 
        u.last_name, 
        u.email, 
        u.avatar_url,
        u.role as app_role,
        COALESCE(wm.role, 'member') as role,
        wm.id as workspace_member_id,
        wm.workspace_id,
        wm.designation, 
        wm.joined_at,
        wm.is_active,
        (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id AND t.status = 'completed') as completed_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id) as total_tasks
      FROM users u
      LEFT JOIN workspace_members wm ON u.id = wm.user_id AND wm.workspace_id = ? AND wm.is_active = true
      WHERE u.is_active = true AND u.role = 'employee'
      ORDER BY u.first_name ASC
    `;

    const members = await query(sql, [Number(safeWorkspaceId) || 0]);

    return NextResponse.json(members, { status: 200 });
  } catch (error) {
    console.error('Fetch members error:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getAuthToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const { workspace_id, user_id, role } = body as { workspace_id?: number; user_id?: number; role?: string };

    if (!workspace_id || !user_id) {
      return NextResponse.json({ error: 'Missing required fields: workspace_id, user_id' }, { status: 400 });
    }

    const memberCheck = await query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND is_active = true',
      [workspace_id, payload.id]
    );
    if (!Array.isArray(memberCheck) || memberCheck.length === 0) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }
    const myRole = (memberCheck[0] as any).role;
    if (myRole !== 'admin' && myRole !== 'manager') {
      return NextResponse.json({ error: 'Only admin or manager can add members' }, { status: 403 });
    }

    const existing = await query(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspace_id, user_id]
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: 'User is already a member' }, { status: 400 });
    }

    const validRole = ['admin', 'manager', 'member', 'viewer'].includes(role || '') ? role : 'member';
    await query(
      'INSERT INTO workspace_members (workspace_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)',
      [workspace_id, user_id, validRole || 'member', payload.id]
    );

    // Email the new member
    const wsRows = await query('SELECT name FROM workspaces WHERE id = ?', [workspace_id]);
    const userRows = await query('SELECT email, first_name FROM users WHERE id = ?', [user_id]);
    if (Array.isArray(wsRows) && wsRows.length > 0 && Array.isArray(userRows) && userRows.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      sendWorkspaceCreated((userRows[0] as any).email, (wsRows[0] as any).name, `${baseUrl}/workspaces`).catch(() => { });
    }

    return NextResponse.json({ message: 'Member added to workspace' }, { status: 201 });
  } catch (error) {
    console.error('Add workspace member error:', error);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}
