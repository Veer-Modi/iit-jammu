import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { openRouterChat } from '@/lib/openrouter';

const getAuthToken = (req: NextRequest): string | null => {
    const authHeader = req.headers.get('authorization');
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

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
        const { workspace_id } = body;

        if (!workspace_id) {
            return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
        }

        // Fetch workspace data
        const workspace = await query('SELECT * FROM workspaces WHERE id = ?', [workspace_id]);
        const projects = await query('SELECT * FROM projects WHERE workspace_id = ?', [workspace_id]);
        const tasks = await query('SELECT * FROM tasks WHERE workspace_id = ?', [workspace_id]);
        const members = await query(
            `SELECT u.first_name, u.last_name FROM users u 
       INNER JOIN workspace_members wm ON u.id = wm.user_id 
       WHERE wm.workspace_id = ?`,
            [workspace_id]
        );

        const workspaceData = Array.isArray(workspace) && workspace.length > 0 ? workspace[0] as any : null;
        const projectList = Array.isArray(projects) ? projects : [];
        const taskList = Array.isArray(tasks) ? tasks : [];
        const memberList = Array.isArray(members) ? members : [];

        if (!workspaceData) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        // Calculate statistics
        const stats = {
            total_projects: projectList.length,
            total_tasks: taskList.length,
            completed_tasks: taskList.filter((t: any) => t.status === 'completed').length,
            in_progress_tasks: taskList.filter((t: any) => t.status === 'in_progress').length,
            team_size: memberList.length,
            completion_rate: taskList.length > 0 ? Math.round((taskList.filter((t: any) => t.status === 'completed').length / taskList.length) * 100) : 0
        };

        // Get AI summary
        const aiPrompt = `Generate a professional executive summary for this startup workspace:

**Workspace**: ${workspaceData.name}
**Projects**: ${stats.total_projects}
**Team Size**: ${stats.team_size}
**Tasks Completed**: ${stats.completed_tasks} / ${stats.total_tasks} (${stats.completion_rate}%)

Provide a 2-3 paragraph executive summary highlighting progress, achievements, and outlook. Keep it professional and concise.`;

        let aiSummary = 'Analytics report generated successfully.';
        try {
            const aiResponse = await openRouterChat([
                { role: 'system', content: 'You are a professional business analyst writing executive summaries.' },
                { role: 'user', content: aiPrompt }
            ]);
            if (aiResponse) aiSummary = aiResponse;
        } catch { }

        // Generate PDF (simplified - return JSON for now, can add PDFKit later)
        const reportData = {
            workspace_name: workspaceData.name,
            generated_at: new Date().toISOString(),
            statistics: stats,
            ai_summary: aiSummary,
            projects: projectList.map((p: any) => ({
                name: p.name,
                description: p.description,
                created_at: p.created_at
            })),
            milestones: taskList.filter((t: any) => t.priority === 'urgent' || t.priority === 'high').map((t: any) => ({
                title: t.title,
                status: t.status,
                priority: t.priority
            }))
        };

        return NextResponse.json(reportData);

    } catch (error) {
        console.error('Analytics report error:', error);
        return NextResponse.json(
            { error: 'Failed to generate report' },
            { status: 500 }
        );
    }
}
