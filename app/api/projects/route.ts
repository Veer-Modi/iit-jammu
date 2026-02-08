import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendSystemMessage } from '@/lib/chat-system';
import { sendProjectCreated } from '@/lib/email';

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

    const wsId = Number(workspace_id);
    if (isNaN(wsId)) {
      return NextResponse.json({ error: 'Invalid Workspace ID' }, { status: 400 });
    }

    // Verify workspace exists
    const wsCheck = await query('SELECT id FROM workspaces WHERE id = ?', [wsId]);
    if (!Array.isArray(wsCheck) || wsCheck.length === 0) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Verify user is member of workspace OR owner of workspace OR is Admin
    console.log(`🔍 [Project Create] Checking auth for User ${payload.id} (Role: ${payload.role}) in Workspace ${workspace_id}`);

    // TRUST ADMINS IMPLICITLY
    if (payload.role === 'admin' || payload.role === 'manager') {
      console.log('✅ User is Admin/Manager. Allowing access.');
    } else {
      const memberCheck = await query(
        'SELECT id FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
        [workspace_id, payload.id]
      );

      // If not a member, check if they are the owner
      if (!Array.isArray(memberCheck) || memberCheck.length === 0) {
        const ownerCheck = await query(
          'SELECT id FROM workspaces WHERE id = ? AND owner_id = ?',
          [workspace_id, payload.id]
        );
        if (!Array.isArray(ownerCheck) || ownerCheck.length === 0) {
          console.error(`❌ Authorization Failed: User ${payload.id} is NOT member/owner of Workspace ${workspace_id}`);
          return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
        }
      }
    }

    // 1. Insert Project into 'projects' table
    const result = await query(
      `INSERT INTO projects (workspace_id, name, description, color, icon, owner_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [workspace_id, name, description || null, color || '#3B82F6', icon || 'folder', payload.id]
    );

    const insertResult = result as any;
    const projectId = insertResult.insertId;

    // 2. Insert Project Members into 'project_members' table
    // Add Owner
    await query(
      'INSERT INTO project_members (project_id, user_id, role, added_by) VALUES (?, ?, ?, ?)',
      [projectId, payload.id, 'owner', payload.id]
    );

    // Add Selected Members (if any)
    const { member_ids } = body; // Get member_ids from request
    if (Array.isArray(member_ids) && member_ids.length > 0) {
      for (const memberId of member_ids) {
        // Prevent duplicate if owner is in list
        if (Number(memberId) !== Number(payload.id)) {
          try {
            await query(
              'INSERT INTO project_members (project_id, user_id, role, added_by) VALUES (?, ?, ?, ?)',
              [projectId, memberId, 'member', payload.id]
            );
          } catch (err) {
            console.error(`Failed to add member ${memberId} to project ${projectId}:`, err);
            // Continue even if one fails
          }
        }
      }
    }

    // Optional: Log activity (Non-blocking)
    query(
      `INSERT INTO activity_logs (workspace_id, user_id, action, entity_type, entity_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [workspace_id, payload.id, 'project_created', 'project', projectId]
    ).catch(console.error);

    // Optional: Email Notifications (Non-blocking)
    const wsMembers = await query('SELECT u.email, u.first_name FROM workspace_members wm JOIN users u ON wm.user_id = u.id WHERE wm.workspace_id = ? AND wm.is_active = true', [workspace_id]);
    const wsRows = await query('SELECT name FROM workspaces WHERE id = ?', [workspace_id]);
    const wsName = Array.isArray(wsRows) && wsRows.length > 0 ? (wsRows[0] as any).name : 'Workspace';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (Array.isArray(wsMembers)) {
      // Send emails in background
      Promise.all(wsMembers.map(m =>
        sendProjectCreated((m as any).email, name, wsName, `${baseUrl}/projects`).catch(e => console.error('Email failed:', e))
      )).catch(e => console.error('Email batch failed:', e));
    }

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
