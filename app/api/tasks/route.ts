import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendSystemMessage } from '@/lib/chat-system';
import { sendTaskAssigned } from '@/lib/email';

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

    // RESTRICT VISIBILITY: Employees can only see their own tasks or tasks they created
    if (payload.role === 'employee') {
      sql += ' AND (t.assigned_to = ? OR t.created_by = ?)';
      params.push(payload.id, payload.id);
    }

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
    console.log('📝 Creating Task Payload:', JSON.stringify(body));

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
      console.error('❌ Missing required fields:', { title, workspace_id, project_id });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify project exists to avoid FK error 500
    const projectCheck = await query('SELECT id FROM projects WHERE id = ?', [project_id]);
    if (!Array.isArray(projectCheck) || projectCheck.length === 0) {
      console.error(`❌ Project ${project_id} does not exist.`);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Sanitize and Cast Inputs
    const pId = Number(project_id);
    const wId = Number(workspace_id);
    const assigneeId = assigned_to ? Number(assigned_to) : null;

    if (isNaN(pId) || isNaN(wId)) {
      console.error('❌ Invalid ID formats:', { pId, wId });
      return NextResponse.json({ error: 'Invalid ID formats' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO tasks 
       (project_id, workspace_id, title, description, status, priority, assigned_to, created_by, due_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pId,
        wId,
        title,
        description || null,
        status || 'todo',
        priority || 'medium',
        assigneeId,
        payload.id,
        due_date || null,
      ]
    );

    const insertResult = result as any;
    const taskId = insertResult.insertId;

    // NON-BLOCKING SIDE EFFECTS (Fire and Forget)
    (async () => {
      try {
        // Log activity
        await query(
          `INSERT INTO activity_logs (workspace_id, user_id, action, entity_type, entity_id) 
           VALUES (?, ?, ?, ?, ?)`,
          [workspace_id, payload.id, 'task_created', 'task', taskId]
        );

        // System Notification
        let assigneeName = 'Unassigned';
        if (assigned_to) {
          const assigneeRows = await query('SELECT first_name, last_name FROM users WHERE id = ?', [assigned_to]);
          if (Array.isArray(assigneeRows) && assigneeRows.length > 0) {
            assigneeName = `${(assigneeRows[0] as any).first_name} ${(assigneeRows[0] as any).last_name}`;
          }
        }
        const projectRows = await query('SELECT name FROM projects WHERE id = ?', [project_id]);
        const projectName = Array.isArray(projectRows) && projectRows.length > 0 ? (projectRows[0] as any).name : 'Unknown project';
        const dueStr = due_date ? `\n**Due date:** ${due_date}` : '';
        await sendSystemMessage(Number(workspace_id), `📋 **New Task Assigned**\n\n**Task:** ${title}\n**Project:** ${projectName}\n**Priority:** ${priority || 'medium'}\n**Assigned to:** ${assigneeName}\n**Status:** ${status || 'todo'}${dueStr}${description ? `\n**Details:** ${description}` : ''}`);

        // Email assignee
        if (assigned_to) {
          const assigneeRows = await query('SELECT email, first_name FROM users WHERE id = ?', [assigned_to]);
          const creatorRows = await query('SELECT first_name FROM users WHERE id = ?', [payload.id]);
          if (Array.isArray(assigneeRows) && assigneeRows.length > 0) {
            const creatorName = Array.isArray(creatorRows) && creatorRows.length > 0 ? (creatorRows[0] as any).first_name : 'Admin';
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            sendTaskAssigned((assigneeRows[0] as any).email, title, projectName, creatorName, `${baseUrl}/tasks`).catch(e => console.error('Email send failed:', e));
          }
        }
      } catch (err) {
        console.error('Running background task side-effects failed:', err);
      }
    })();

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
