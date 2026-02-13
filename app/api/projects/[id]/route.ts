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

async function requireWorkspaceRole(workspaceId: number, userId: number) {
  const rows = await query(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND is_active = true',
    [workspaceId, userId]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (rows[0] as any).role as string;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const { id } = await params;
    const projectId = Number(id);
    if (Number.isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project id' }, { status: 400 });
    }

    const body = await req.json();
    const { status, name, description, color, icon } = body as {
      status?: 'active' | 'archived' | 'completed';
      name?: string;
      description?: string | null;
      color?: string | null;
      icon?: string | null;
    };

    const rows = await query('SELECT workspace_id, status as old_status, name FROM projects WHERE id = ?', [projectId]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const workspaceId = Number((rows[0] as any).workspace_id);
    const oldStatus = (rows[0] as any).old_status as string;
    const projectName = (rows[0] as any).name as string;

    const role = await requireWorkspaceRole(workspaceId, auth.payload.id);
    if (!role) return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(projectId);
    await query(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);

    if (status === 'completed' && oldStatus !== 'completed') {
      const existing = await query(
        'SELECT id FROM milestones WHERE project_id = ? AND workspace_id = ? AND title = ? LIMIT 1',
        [projectId, workspaceId, `Project Completed: ${projectName}`]
      );

      if (!Array.isArray(existing) || existing.length === 0) {
        await query(
          `INSERT INTO milestones (project_id, workspace_id, title, description, due_date, status, progress_percentage, created_by)
           VALUES (?, ?, ?, ?, CURDATE(), 'completed', 100, ?)`,
          [
            projectId,
            workspaceId,
            `Project Completed: ${projectName}`,
            'Auto-generated milestone upon project completion',
            auth.payload.id,
          ]
        );
      }
    }

    await query(
      `INSERT INTO activity_logs (workspace_id, user_id, action, entity_type, entity_id)
       VALUES (?, ?, ?, ?, ?)`,
      [workspaceId, auth.payload.id, 'project_updated', 'project', projectId]
    );

    return NextResponse.json({ message: 'Project updated' }, { status: 200 });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
