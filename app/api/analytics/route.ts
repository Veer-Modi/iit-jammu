import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

const getAuthToken = (req: NextRequest): string | null => {
  const authHeader = req.headers.get('authorization');
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

async function requireWorkspaceMember(workspaceId: number, userId: number) {
  const rows = await query(
    'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND is_active = true',
    [workspaceId, userId]
  );
  return Array.isArray(rows) && rows.length > 0;
}

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
    const type = searchParams.get('type') || 'overview';
    const daysParam = searchParams.get('days') || '42';

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const workspaceIdNum = Number(workspaceId);
    if (Number.isNaN(workspaceIdNum)) {
      return NextResponse.json({ error: 'Invalid workspaceId' }, { status: 400 });
    }

    const allowed = await requireWorkspaceMember(workspaceIdNum, payload.id);
    if (!allowed) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
    }

    const days = Math.max(7, Math.min(180, Number(daysParam) || 42));

    let analytics: any = {};

    if (type === 'overview' || type === 'all') {
      // Workspace Statistics
      const stats = await query(
        `SELECT 
          COUNT(DISTINCT wm.user_id) as team_members,
          COUNT(DISTINCT p.id) as total_projects,
          COUNT(DISTINCT t.id) as total_tasks,
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
          COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
          COUNT(CASE WHEN t.status = 'todo' THEN 1 END) as todo_tasks
        FROM workspaces w
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
        LEFT JOIN projects p ON w.id = p.workspace_id AND p.status = 'active'
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE w.id = ?`,
        [workspaceIdNum]
      );

      analytics.workspace_stats = Array.isArray(stats) ? stats[0] : stats;
    }

    if (type === 'tasks' || type === 'all') {
      // Task Status Distribution
      const taskStats = await query(
        `SELECT 
          status,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM tasks WHERE workspace_id = ?), 0), 2) as percentage
        FROM tasks
        WHERE workspace_id = ?
        GROUP BY status`,
        [workspaceIdNum, workspaceIdNum]
      );

      analytics.task_stats = taskStats;

      const priorityDist = await query(
        `SELECT priority as name, COUNT(*) as value
         FROM tasks
         WHERE workspace_id = ?
         GROUP BY priority
         ORDER BY value DESC`,
        [workspaceIdNum]
      );
      analytics.priority_distribution = priorityDist;

      const completionTrend = await query(
        `SELECT DATE(s.changed_at) as date, COUNT(*) as completed
         FROM status_update_history s
         INNER JOIN tasks t ON s.task_id = t.id
         WHERE t.workspace_id = ? AND s.new_status = 'completed' AND s.changed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(s.changed_at)
         ORDER BY DATE(s.changed_at) ASC`,
        [workspaceIdNum, days]
      );
      analytics.completion_trend = completionTrend;
    }

    if (type === 'team' || type === 'all') {
      // Team Performance
      const teamPerf = await query(
        `SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
          COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
          COUNT(DISTINCT t.id) as total_assigned_tasks
        FROM users u
        LEFT JOIN tasks t ON u.id = t.assigned_to AND t.workspace_id = ?
        WHERE u.is_active = true
        GROUP BY u.id, u.email, u.first_name, u.last_name
        ORDER BY completed_tasks DESC`,
        [workspaceIdNum]
      );

      analytics.team_performance = teamPerf;
    }

    if (type === 'milestones' || type === 'all') {
      // Milestone Achievement
      // Milestone Achievement - NOW MAPPED TO PROJECTS
      const milestones = await query(
        `SELECT 
          p.id,
          p.name as title,
          p.created_at as due_date,
          p.status,
          CASE 
            WHEN p.status = 'completed' THEN 100 
            ELSE (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'completed') * 100.0 / NULLIF((SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id), 1)
          END as progress_percentage,
          p.name as project_name
        FROM projects p
        WHERE p.workspace_id = ?
        ORDER BY p.created_at DESC`,
        [workspaceIdNum]
      );

      analytics.milestones = milestones;

      // Completed Projects for Pitch Deck
      const completedProjects = await query(
        `SELECT name, description, status FROM projects WHERE workspace_id = ? AND status = 'completed'`,
        [workspaceIdNum]
      );
      analytics.completed_projects = completedProjects;
    }

    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
