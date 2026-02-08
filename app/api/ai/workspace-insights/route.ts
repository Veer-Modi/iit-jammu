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

        // Verify user has access to workspace
        const memberRows = await query(
            'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
            [workspace_id, payload.id]
        );

        if (!Array.isArray(memberRows) || memberRows.length === 0) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Fetch workspace data
        const tasks = await query(
            `SELECT id, title, status, priority, assigned_to, due_date, created_at 
       FROM tasks WHERE workspace_id = ?`,
            [workspace_id]
        );

        const users = await query(
            `SELECT u.id, u.first_name, u.last_name 
       FROM users u
       INNER JOIN workspace_members wm ON u.id = wm.user_id
       WHERE wm.workspace_id = ? AND wm.is_active = TRUE`,
            [workspace_id]
        );

        const projects = await query(
            `SELECT id, name, created_at FROM projects WHERE workspace_id = ?`,
            [workspace_id]
        );

        const taskList = Array.isArray(tasks) ? tasks : [];
        const userList = Array.isArray(users) ? users : [];
        const projectList = Array.isArray(projects) ? projects : [];

        // Build AI analysis prompt
        const prompt = `You are an AI assistant analyzing a startup's task management workspace. Identify critical issues, bottlenecks, and team health risks.

**Workspace Data:**
- Total Tasks: ${taskList.length}
- Total Projects: ${projectList.length}
- Team Members: ${userList.length}

**Task Breakdown:**
- Todo: ${taskList.filter((t: any) => t.status === 'todo').length}
- In Progress: ${taskList.filter((t: any) => t.status === 'in_progress').length}
- In Review: ${taskList.filter((t: any) => t.status === 'in_review').length}
- Completed: ${taskList.filter((t: any) => t.status === 'completed').length}
- Overdue: ${taskList.filter((t: any) => t.due_date && new Date(t.due_date) < new Date()).length}

**Task Assignment Distribution:**
${userList.map((u: any) => {
            const userTasks = taskList.filter((t: any) => t.assigned_to === u.id);
            const completedTasks = userTasks.filter((t: any) => t.status === 'completed').length;
            const inProgressTasks = userTasks.filter((t: any) => t.status === 'in_progress').length;
            const overdueTasks = userTasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date()).length;
            return `- ${u.first_name} ${u.last_name}: ${userTasks.length} tasks (${inProgressTasks} in progress, ${completedTasks} completed, ${overdueTasks} overdue)`;
        }).join('\n')}

**High Priority Tasks:** ${taskList.filter((t: any) => t.priority === 'high' || t.priority === 'urgent').length}

Analyze this data and provide:
1. **Critical Risks** - Identify overworked team members (>8 active tasks), deadline risks, blocked progress
2. **Bottlenecks** - Find where work is stuck or concentrated
3. **Actionable Recommendations** - Specific steps to improve workflow (max 3)

Return ONLY valid JSON with this exact structure:
{
  "summary": "brief overall assessment",
  "risks": ["risk 1", "risk 2"],
  "bottlenecks": ["bottleneck 1"],
  "recommendations": ["rec 1", "rec 2", "rec 3"]
}`;

        // Call OpenRouter AI
        const aiResponse = await openRouterChat([
            {
                role: 'system',
                content: 'You are an expert in project management and team productivity analysis for startups. Always respond with valid JSON.',
            },
            {
                role: 'user',
                content: prompt,
            },
        ], { reasoning: true });

        if (!aiResponse) {
            return NextResponse.json({
                summary: 'AI analysis unavailable. Check OpenRouter API key configuration.',
                risks: [],
                bottlenecks: [],
                recommendations: [],
            });
        }

        // Parse AI response
        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const insights = JSON.parse(jsonMatch[0]);
                return NextResponse.json(insights);
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
        }

        // Fallback response
        return NextResponse.json({
            summary: aiResponse.substring(0, 200),
            risks: [],
            bottlenecks: [],
            recommendations: [],
        });

    } catch (error) {
        console.error('Workspace insights error:', error);
        return NextResponse.json(
            { error: 'Failed to generate insights' },
            { status: 500 }
        );
    }
}
