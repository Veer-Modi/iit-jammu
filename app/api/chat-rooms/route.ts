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
    const workspaceId = searchParams.get('workspaceId');

    // Fetch all rooms (global access)
    // We can filter by workspace if provided, but default to all relevant rooms
    // Fetch all rooms (global access)
    // For DMs, we want to know the "other" person's name and avatar.
    // We achieve this by subquerying the other member.
    let queryStr = `
      SELECT cr.*, COALESCE(cn.unread_count, 0) as unread_count, 
             (SELECT CONCAT(first_name, ' ', last_name) 
              FROM users u 
              JOIN chat_room_members crm2 ON u.id = crm2.user_id 
              WHERE crm2.room_id = cr.id AND u.id != ? LIMIT 1) as dm_name,
             (SELECT avatar_url 
              FROM users u 
              JOIN chat_room_members crm2 ON u.id = crm2.user_id 
              WHERE crm2.room_id = cr.id AND u.id != ? LIMIT 1) as dm_avatar
      FROM chat_rooms cr
      INNER JOIN chat_room_members crm ON cr.id = crm.room_id
      LEFT JOIN chat_notifications cn ON cr.id = cn.room_id AND cn.user_id = crm.user_id
      WHERE crm.user_id = ? AND cr.is_archived = false
      ORDER BY cr.updated_at DESC, cr.created_at DESC`;



    const userId = Number(payload.id);
    const rooms = await query(queryStr, [userId, userId, userId]);

    return NextResponse.json(rooms, { status: 200 });
  } catch (error) {
    console.error('Fetch chat rooms error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat rooms' },
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
    const { workspace_id, name, type, description, member_ids } = body;

    if (!workspace_id || !name || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const creatorId = Number(payload.id);

    // Check for existing DM if type is 'direct'
    if (type === 'direct' && Array.isArray(member_ids) && member_ids.length === 1) {
      const targetId = Number(member_ids[0]);
      // Find if there's a room with exactly these 2 members and type 'direct'
      const existing = await query(
        `SELECT r.id 
         FROM chat_rooms r
         JOIN chat_room_members m1 ON r.id = m1.room_id
         JOIN chat_room_members m2 ON r.id = m2.room_id
         WHERE r.type = 'direct' 
         AND m1.user_id = ? 
         AND m2.user_id = ?
         LIMIT 1`,
        [creatorId, targetId]
      );

      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json({
          message: 'Chat room already exists',
          roomId: (existing[0] as any).id
        }, { status: 200 });
      }
    }

    // Create chat room
    const result = await query(
      `INSERT INTO chat_rooms (workspace_id, name, type, description, created_by) 
       VALUES (?, ?, ?, ?, ?)`,
      [workspace_id, name, type, description || null, creatorId]
    );

    const insertResult = result as any;
    const roomId = insertResult.insertId;

    // Add creator as member
    await query(
      'INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)',
      [roomId, creatorId]
    );

    // Add other members if provided
    if (Array.isArray(member_ids) && member_ids.length > 0) {
      // Filter out creator from member_ids to avoid duplicates
      const uniqueMembers = new Set(member_ids.filter((id: number) => Number(id) !== creatorId));
      for (const memberId of uniqueMembers) {
        await query(
          'INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)',
          [roomId, memberId]
        );
      }
    }

    return NextResponse.json(
      {
        message: 'Chat room created successfully',
        roomId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create chat room error:', error);
    return NextResponse.json(
      { error: 'Failed to create chat room' },
      { status: 500 }
    );
  }
}
