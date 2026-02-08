import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

const getAuthToken = (req: NextRequest): string | null => {
  const authHeader = req.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

// PATCH: Update task status/details
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const token = getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const taskId = parseInt(params.id);
    const body = await req.json();

    // Fetch current task to get old status and assignee
    const tasks = await query(
      'SELECT status, workspace_id, assigned_to FROM tasks WHERE id = ?',
      [taskId]
    );

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const oldStatus = (tasks[0] as any).status;
    const workspaceId = (tasks[0] as any).workspace_id;
    const oldAssignedTo = (tasks[0] as any).assigned_to;

    // Update task
    const updates: string[] = [];
    const values: any[] = [];

    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }
    if (body.priority !== undefined) {
      updates.push('priority = ?');
      values.push(body.priority);
    }
    if (body.assigned_to !== undefined) {
      // Logic: Employees cannot reassign tasks to others (except maybe back to unassigned? User implied strict no)
      if (payload.role === 'employee') {
        return NextResponse.json({ error: 'Employees cannot reassign tasks.' }, { status: 403 });
      }
      updates.push('assigned_to = ?');
      values.push(body.assigned_to);
    }
    if (body.due_date !== undefined) {
      updates.push('due_date = ?');
      values.push(body.due_date);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = NOW()');
    values.push(taskId);

    const updateSql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
    await query(updateSql, values);

    // Log status change if applicable
    if (body.status !== undefined && body.status !== oldStatus) {
      await query(
        `INSERT INTO status_update_history (task_id, old_status, new_status, changed_by) 
         VALUES (?, ?, ?, ?)`,
        [taskId, oldStatus, body.status, payload.id]
      );
    }

    // Log assignment change if applicable
    if (body.assigned_to !== undefined && body.assigned_to !== oldAssignedTo) {
      await query(
        `INSERT INTO task_assignments_history (task_id, old_assigned_to, new_assigned_to, changed_by)
         VALUES (?, ?, ?, ?)`,
        [taskId, oldAssignedTo ?? null, body.assigned_to ?? null, payload.id]
      );
    }

    // Log activity
    await query(
      `INSERT INTO activity_logs (workspace_id, user_id, action, entity_type, entity_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [workspaceId, payload.id, 'task_updated', 'task', taskId]
    );

    return NextResponse.json(
      { message: 'Task updated successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const taskId = parseInt(params.id);

    // Fetch task to verify access
    const tasks = await query('SELECT workspace_id FROM tasks WHERE id = ?', [
      taskId,
    ]);

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const workspaceId = (tasks[0] as any).workspace_id;

    // Delete task
    await query('DELETE FROM tasks WHERE id = ?', [taskId]);

    // Log activity
    await query(
      `INSERT INTO activity_logs (workspace_id, user_id, action, entity_type, entity_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [workspaceId, payload.id, 'task_deleted', 'task', taskId]
    );

    return NextResponse.json(
      { message: 'Task deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
