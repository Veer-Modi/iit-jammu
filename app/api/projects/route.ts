import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendSystemMessage } from '@/lib/chat-system';

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

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const projects = await query(
      `SELECT p.*, u.first_name, u.last_name 
       FROM projects p
       LEFT JOIN users u ON p.owner_id = u.id
       WHERE p.workspace_id = ? AND p.status != 'archived'
       ORDER BY p.created_at DESC`,
      [workspaceId]
    );

    return NextResponse.json(projects, { status: 200 });
  } catch (error) {
    console.error('Fetch projects error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { workspace_id, name, description, color, icon } = body;

    if (!workspace_id || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user is member of workspace
    const members = await query(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspace_id, payload.id]
    );

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this workspace' },
        { status: 403 }
      );
    }

    const result = await query(
      `INSERT INTO projects (workspace_id, name, description, color, icon, owner_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [workspace_id, name, description || null, color || '#3B82F6', icon || 'folder', payload.id]
    );

    const insertResult = result as any;
    const projectId = insertResult.insertId;

    // Add owner as project member
    await query(
      'INSERT INTO project_members (project_id, user_id, role, added_by) VALUES (?, ?, ?, ?)',
      [projectId, payload.id, 'owner', payload.id]
    );

    await query(
      `INSERT INTO milestones (project_id, workspace_id, title, description, due_date, status, progress_percentage, created_by)
       VALUES (?, ?, ?, ?, CURDATE(), 'pending', 0, ?)`,
      [
        projectId,
        workspace_id,
        `Project Created: ${name}`,
        'Auto-generated milestone upon project creation',
        payload.id,
      ]
    );

    // Log activity
    await query(
      `INSERT INTO activity_logs (workspace_id, user_id, action, entity_type, entity_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [workspace_id, payload.id, 'project_created', 'project', projectId]
    );

    // System Notification (announcement in General)
    const ownerRows = await query('SELECT first_name, last_name FROM users WHERE id = ?', [payload.id]);
    const ownerName = Array.isArray(ownerRows) && ownerRows.length > 0 ? `${(ownerRows[0] as any).first_name} ${(ownerRows[0] as any).last_name}` : 'Unknown';
    await sendSystemMessage(Number(workspace_id), `📢 **New Project Created**\n\n**Project:** ${name}\n**Description:** ${description || 'No description'}\n**Created by:** ${ownerName}`);

    return NextResponse.json(
      {
        message: 'Project created successfully',
        projectId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
