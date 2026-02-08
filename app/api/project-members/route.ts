import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

const getAuthToken = (req: NextRequest): string | null => {
  const authHeader = req.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

async function requireAuth(req: NextRequest) {
  const token = getAuthToken(req);
  if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const payload = verifyToken(token);
  if (!payload) return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };

  return { payload };
}

async function requireWorkspaceMember(workspaceId: number, userId: number) {
  const rows = await query(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND is_active = true',
    [workspaceId, userId]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (rows[0] as any).role as string;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const projectIdParam = searchParams.get('projectId');

    if (!projectIdParam) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const projectId = Number(projectIdParam);
    if (Number.isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId' }, { status: 400 });
    }

    const projRows = await query('SELECT workspace_id FROM projects WHERE id = ?', [projectId]);
    if (!Array.isArray(projRows) || projRows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const workspaceId = Number((projRows[0] as any).workspace_id);
    const requesterRole = await requireWorkspaceMember(workspaceId, auth.payload.id);
    if (!requesterRole) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    const members = await query(
      `SELECT pm.id, pm.project_id, pm.user_id, pm.role as project_role, pm.added_at,
              u.email, u.first_name, u.last_name, u.avatar_url,
              wm.role as workspace_role
       FROM project_members pm
       INNER JOIN users u ON pm.user_id = u.id
       LEFT JOIN workspace_members wm ON wm.workspace_id = ? AND wm.user_id = pm.user_id AND wm.is_active = true
       WHERE pm.project_id = ?
       ORDER BY pm.added_at DESC`,
      [workspaceId, projectId]
    );

    return NextResponse.json(members, { status: 200 });
  } catch (error) {
    console.error('Fetch project members error:', error);
    return NextResponse.json({ error: 'Failed to fetch project members' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const { project_id, user_id, role } = body as {
      project_id?: number;
      user_id?: number;
      role?: 'owner' | 'member' | 'viewer';
    };

    if (!project_id || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const projRows = await query('SELECT workspace_id FROM projects WHERE id = ?', [project_id]);
    if (!Array.isArray(projRows) || projRows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const workspaceId = Number((projRows[0] as any).workspace_id);
    const requesterRole = await requireWorkspaceMember(workspaceId, auth.payload.id);
    if (!requesterRole) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }
    if (requesterRole !== 'admin' && requesterRole !== 'manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const workspaceMembership = await query(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND is_active = true',
      [workspaceId, user_id]
    );
    if (!Array.isArray(workspaceMembership) || workspaceMembership.length === 0) {
      return NextResponse.json({ error: 'User must be a workspace member first' }, { status: 400 });
    }

    await query(
      `INSERT INTO project_members (project_id, user_id, role, added_by)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [project_id, user_id, role || 'member', auth.payload.id]
    );

    return NextResponse.json({ message: 'Project member added' }, { status: 201 });
  } catch (error) {
    console.error('Add project member error:', error);
    return NextResponse.json({ error: 'Failed to add project member' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const { id } = body as { id?: number };

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const rows = await query(
      `SELECT pm.id, pm.project_id, p.workspace_id
       FROM project_members pm
       INNER JOIN projects p ON pm.project_id = p.id
       WHERE pm.id = ?`,
      [id]
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Project member not found' }, { status: 404 });
    }

    const workspaceId = Number((rows[0] as any).workspace_id);
    const requesterRole = await requireWorkspaceMember(workspaceId, auth.payload.id);
    if (!requesterRole) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }
    if (requesterRole !== 'admin' && requesterRole !== 'manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await query('DELETE FROM project_members WHERE id = ?', [id]);
    return NextResponse.json({ message: 'Project member removed' }, { status: 200 });
  } catch (error) {
    console.error('Remove project member error:', error);
    return NextResponse.json({ error: 'Failed to remove project member' }, { status: 500 });
  }
}
