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

    const sql = `
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.avatar_url,
        u.role as global_role,
        COALESCE(wm.role, u.role) as role, 
        wm.job_title, 
        wm.department, 
        wm.joined_at,
        wm.equity,
        wm.is_active,
        (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id AND t.status = 'completed') as completed_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = u.id) as total_tasks
      FROM users u
      LEFT JOIN workspace_members wm ON u.id = wm.user_id AND wm.workspace_id = ?
      WHERE u.is_active = true AND u.role = 'employee'
      ORDER BY 
        u.first_name ASC
    `;

    // If workspaceId is null (shouldn't be per logic, but for safety), pass 0 or handle
    const safeWorkspaceId = workspaceId || 0;

    const members = await query(sql, [safeWorkspaceId]);

    return NextResponse.json(members, { status: 200 });
  } catch (error) {
    console.error('Fetch members error:', error);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}
