import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendTaskCommentToAdminDm } from '@/lib/chat-system';

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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const tasks = await query('SELECT workspace_id FROM tasks WHERE id = ?', [taskId]);
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const workspaceId = (tasks[0] as any).workspace_id;
    const membership = await query(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND is_active = true',
      [workspaceId, auth.payload.id]
    );

    if (!Array.isArray(membership) || membership.length === 0) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    const comments = await query(
      `SELECT tc.*, u.first_name, u.last_name, u.avatar_url
       FROM task_comments tc
       INNER JOIN users u ON tc.user_id = u.id
       WHERE tc.task_id = ?
       ORDER BY tc.created_at ASC`,
      [taskId]
    );

    return NextResponse.json(comments, { status: 200 });
  } catch (error) {
    console.error('Fetch task comments error:', error);
    return NextResponse.json({ error: 'Failed to fetch task comments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if ('error' in auth) return auth.error;

    const body = await req.json();
    const { task_id, content } = body as { task_id?: number; content?: string };

    if (!task_id || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const tasks = await query('SELECT workspace_id, title FROM tasks WHERE id = ?', [task_id]);
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const workspaceId = (tasks[0] as any).workspace_id;
    const taskTitle = (tasks[0] as any).title || 'Task';
    const membership = await query(
      'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND is_active = true',
      [workspaceId, auth.payload.id]
    );

    if (!Array.isArray(membership) || membership.length === 0) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    const result = await query(
      'INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)',
      [task_id, auth.payload.id, content]
    );

    const insertResult = result as any;
    const commentId = insertResult.insertId;

    const comments = await query(
      `SELECT tc.*, u.first_name, u.last_name, u.avatar_url
       FROM task_comments tc
       INNER JOIN users u ON tc.user_id = u.id
       WHERE tc.id = ?`,
      [commentId]
    );

    // Send to admin's DM so admin sees daily task updates
    const commenterRows = await query('SELECT first_name, last_name FROM users WHERE id = ?', [auth.payload.id]);
    const commenterName = Array.isArray(commenterRows) && commenterRows.length > 0
      ? `${(commenterRows[0] as any).first_name} ${(commenterRows[0] as any).last_name}`
      : 'Employee';
    sendTaskCommentToAdminDm(workspaceId, auth.payload.id, commenterName, task_id, taskTitle, content).catch(() => {});

    return NextResponse.json({ message: 'Comment added successfully', data: comments[0] }, { status: 201 });
  } catch (error) {
    console.error('Create task comment error:', error);
    return NextResponse.json({ error: 'Failed to create task comment' }, { status: 500 });
  }
}
