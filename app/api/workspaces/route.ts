import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendSystemMessage } from '@/lib/chat-system';
import { sendWorkspaceCreated } from '@/lib/email';

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

    // Get user's workspaces
    const workspaces = await query(
      `SELECT w.* FROM workspaces w 
       INNER JOIN workspace_members wm ON w.id = wm.workspace_id 
       WHERE wm.user_id = ? AND w.is_active = true
       ORDER BY w.created_at DESC`,
      [payload.id]
    );

    return NextResponse.json(workspaces, { status: 200 });
  } catch (error) {
    console.error('Fetch workspaces error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
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
    const { name, description, member_ids } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      );
    }

    // Create workspace
    const result = await query(
      'INSERT INTO workspaces (owner_id, name, description) VALUES (?, ?, ?)',
      [payload.id, name, description || null]
    );

    const insertResult = result as any;
    const workspaceId = insertResult.insertId;

    // Add owner as admin member
    await query(
      'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
      [workspaceId, payload.id, 'admin']
    );

    // Create General channel for this workspace (for announcements & team chat)
    await query(
      `INSERT INTO chat_rooms (workspace_id, name, type, description, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [workspaceId, 'General', 'channel', 'General discussion and announcements', payload.id]
    );
    const generalRoomResult = await query('SELECT id FROM chat_rooms WHERE workspace_id = ? AND name = ? ORDER BY id DESC LIMIT 1', [workspaceId, 'General']);
    const generalRoomId = Array.isArray(generalRoomResult) && generalRoomResult.length > 0 ? (generalRoomResult[0] as any).id : null;
    if (generalRoomId) {
      await query('INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)', [generalRoomId, payload.id]);
    }

    // Add selected employees to workspace
    if (Array.isArray(member_ids) && member_ids.length > 0) {
      const emailPromises = [];
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      for (const userId of member_ids) {
        // Add to workspace_members
        try {
          await query(
            'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)',
            [workspaceId, userId, 'member']
          );
        } catch (e) {
          console.error(`Failed to add user ${userId} to workspace ${workspaceId}:`, e);
        }

        // Add to General room
        if (generalRoomId) {
          try {
            await query('INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)', [generalRoomId, userId]);
          } catch (e) {
            console.error(`Failed to add user ${userId} to general room:`, e);
          }
        }

        // Fetch user email for notification
        const userRows = await query('SELECT email, first_name FROM users WHERE id = ?', [userId]);
        if (Array.isArray(userRows) && userRows.length > 0) {
          const u = userRows[0] as any;
          // Send email (async)
          emailPromises.push(
            sendWorkspaceCreated(u.email, name, `${baseUrl}/workspaces`).catch(e => console.error('Workspace email failed:', e))
          );
        }
      }
      // Fire and forget emails
      Promise.all(emailPromises).catch(e => console.error('Workspace email batch failed:', e));
    }

    // System Notification (announcement in General)
    await sendSystemMessage(Number(workspaceId), `🚀 **Workspace Created**\n\n**Name:** ${name}\n**Description:** ${description || 'No description'}\n\nWelcome to your new workspace!`);

    // Fetch created workspace
    const workspaces = await query(
      'SELECT * FROM workspaces WHERE id = ?',
      [workspaceId]
    );

    return NextResponse.json(
      {
        message: 'Workspace created successfully',
        workspace: (workspaces as any[])[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create workspace error:', error);
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
