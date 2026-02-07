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
    const projectId = searchParams.get('projectId');
    const workspaceId = searchParams.get('workspaceId');
    const status = searchParams.get('status');

    let sql = `SELECT t.*, u.first_name, u.last_name, u.email 
               FROM tasks t
               LEFT JOIN users u ON t.assigned_to = u.id
               WHERE t.workspace_id = ?`;
    const params: any[] = [workspaceId];

    if (projectId) {
      sql += ' AND t.project_id = ?';
      params.push(projectId);
    }

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    const assignedTo = searchParams.get('assigned_to');
    if (assignedTo) {
      sql += ' AND t.assigned_to = ?';
      params.push(assignedTo);
    }

    sql += ' ORDER BY t.created_at DESC';

    const tasks = await query(sql, params);
    return NextResponse.json(tasks, { status: 200 });
  } catch (error) {
    console.error('Fetch tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
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
    const {
      project_id,
      workspace_id,
      title,
      description,
      status,
      priority,
      assigned_to,
      due_date,
    } = body;

    if (!title || !workspace_id || !project_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO tasks 
       (project_id, workspace_id, title, description, status, priority, assigned_to, created_by, due_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project_id,
        workspace_id,
        title,
        description || null,
        status || 'todo',
        priority || 'medium',
        assigned_to || null,
        payload.id,
        due_date || null,
      ]
    );

    const insertResult = result as any;
    const taskId = insertResult.insertId;

    // Log activity
    await query(
      `INSERT INTO activity_logs (workspace_id, user_id, action, entity_type, entity_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [workspace_id, payload.id, 'task_created', 'task', taskId]
    );

    return NextResponse.json(
      {
        message: 'Task created successfully',
        taskId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
