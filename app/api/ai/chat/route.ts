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
        const { message, workspace_id } = body;

        if (!message || message.trim().length < 3) {
            return NextResponse.json({ error: 'Please provide a message (min 3 characters)' }, { status: 400 });
        }

        // Get comprehensive workspace/user data from DB
        let contextData = '';

        try {
            // Get user's workspaces
            const workspaces = await query(
                `SELECT w.* FROM workspaces w 
         INNER JOIN workspace_members wm ON w.id = wm.workspace_id 
         WHERE wm.user_id = ? AND wm.is_active = true`,
                [payload.id]
            );

            // Get ALL users (employees and admins) for complete team context
            const employees = await query(
                `SELECT id, first_name, last_name, email, role, designation FROM users WHERE is_active = true`
            );

            // Get tasks (increased limit)
            const tasks = workspace_id
                ? await query(`SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100`, [workspace_id])
                : await query(`SELECT * FROM tasks WHERE assigned_to = ? OR created_by = ? ORDER BY created_at DESC LIMIT 100`, [payload.id, payload.id]);

            // Get projects
            const projects = workspace_id
                ? await query(`SELECT * FROM projects WHERE workspace_id = ?`, [workspace_id])
                : await query(
                    `SELECT p.* FROM projects p 
             INNER JOIN project_members pm ON p.id = pm.project_id 
             WHERE pm.user_id = ?`,
                    [payload.id]
                );

            contextData = `
**DATABASE RECORD (LIVE DATA):**

**ALL TEAM MEMBERS (${Array.isArray(employees) ? employees.length : 0} total):**
${Array.isArray(employees) ? employees.map((e: any) => `- [ID:${e.id}] ${e.first_name} ${e.last_name} (${e.role}${e.designation ? ` - ${e.designation}` : ''})`).join('\n') : 'None'}

**PROJECTS (${Array.isArray(projects) ? projects.length : 0}):**
${Array.isArray(projects) ? projects.map((p: any) => `- [ID:${p.id}] ${p.name}: ${p.description || ''} (Status: ${p.status})`).join('\n') : 'None'}

**RECENT TASKS (${Array.isArray(tasks) ? tasks.length : 0}):**
${Array.isArray(tasks) ? tasks.slice(0, 30).map((t: any) =>
                `- [ID:${t.id}] [${t.status.toUpperCase()}] ${t.title} (Priority: ${t.priority}, Assigned User ID: ${t.assigned_to || 'Unassigned'})`
            ).join('\n') : 'None'}
`;
        } catch (dbError) {
            console.error('Error fetching context:', dbError);
            contextData = 'Unable to fetch database context.';
        }

        const systemPrompt = `You are an AI assistant integrated into a task management system.
        
CRITICAL: You have been provided with the LIVE DATABASE RECORD above. You MUST use this data to answer questions.
- If the user asks "How many employees?", COUNT the employees listed in the "ALL TEAM MEMBERS" section.
- If the user asks about tasks, read from the "RECENT TASKS" section.
- Do NOT say "I cannot access the database". The data is right there in your context.
- When assigning tasks, refer to users by their ID and Name from the "ALL TEAM MEMBERS" list.

Your role is to:
1. Help with task assignments - suggest which employee should work on what based on their current workload
2. Identify team members who are overloaded or underutilized
3. Provide insights on project progress and bottlenecks
4. Answer questions about the workspace, tasks, and team
5. Give actionable recommendations

When suggesting task assignments, ALWAYS mention the employee by name AND their ID number like this: "Assign to John Doe (ID: 5)"

Be concise, actionable, and data-driven.`;

        const userPrompt = `${contextData}

**USER QUESTION:**
${message}

Provide a helpful, actionable response based on the database context above.`;

        const aiResponse = await openRouterChat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], { reasoning: true });

        return NextResponse.json({
            response: aiResponse || 'AI service unavailable. Please check OpenRouter configuration.',
            hasContext: contextData.length > 100
        });

    } catch (error) {
        console.error('AI chat error:', error);
        return NextResponse.json(
            { error: 'Failed to get AI response' },
            { status: 500 }
        );
    }
}
