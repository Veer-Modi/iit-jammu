import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';

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
    const roomId = searchParams.get('roomId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // Check if user is member of room
    const membership = await query(
      'SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ?',
      [roomId, payload.id]
    );

    if (!Array.isArray(membership) || membership.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this room' },
        { status: 403 }
      );
    }

    const messages = await query(
      `SELECT m.*, u.first_name, u.last_name, u.avatar_url
       FROM messages m
       INNER JOIN users u ON m.sender_id = u.id
       WHERE m.room_id = ?
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [roomId, limit, offset]
    );

    return NextResponse.json((messages as any[]).reverse(), { status: 200 });
  } catch (error) {
    console.error('Fetch messages error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
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
    const { room_id, content, message_type, attachment_url } = body;

    if (!room_id || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user is member of room
    const membership = await query(
      'SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ?',
      [room_id, payload.id]
    );

    if (!Array.isArray(membership) || membership.length === 0) {
      return NextResponse.json(
        { error: 'Not a member of this room' },
        { status: 403 }
      );
    }

    const result = await query(
      `INSERT INTO messages (room_id, sender_id, content, message_type, attachment_url) 
       VALUES (?, ?, ?, ?, ?)`,
      [room_id, payload.id, content, message_type || 'text', attachment_url || null]
    );

    const insertResult = result as any;
    const messageId = insertResult.insertId;

    // Increment unread count for other members
    // 1. Get all members of the room
    const members = await query(
      'SELECT user_id FROM chat_room_members WHERE room_id = ?',
      [room_id]
    );

    // 2. Loop and upsert notifications (could be optimized with a single query but loop is safer for logic)
    // Optimization: INSERT INTO ... SELECT ...
    await query(
      `INSERT INTO chat_notifications (user_id, room_id, unread_count)
         SELECT user_id, ?, 1
         FROM chat_room_members
         WHERE room_id = ? AND user_id != ?
         ON DUPLICATE KEY UPDATE unread_count = unread_count + 1, updated_at = CURRENT_TIMESTAMP`,
      [room_id, room_id, payload.id]
    );

    // Fetch created message with user details
    const messages = await query(
      `SELECT m.*, u.first_name, u.last_name, u.avatar_url
       FROM messages m
       INNER JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );

    return NextResponse.json(
      {
        message: 'Message sent successfully',
        data: (messages as any[])[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = getAuthToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const { id, content } = body;

    // Verify ownership
    const existing = await query('SELECT sender_id, room_id FROM messages WHERE id = ?', [id]);
    if (!Array.isArray(existing) || existing.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    const msg = (existing as any[])[0];
    if (msg.sender_id !== payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await query('UPDATE messages SET content = ?, is_edited = TRUE, edited_at = CURRENT_TIMESTAMP WHERE id = ?', [content, id]);

    // Fetch updated
    const updated = await query('SELECT * FROM messages WHERE id = ?', [id]);

    return NextResponse.json((updated as any[])[0]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = getAuthToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // Verify ownership
    const existing = await query('SELECT sender_id, room_id FROM messages WHERE id = ?', [id]);
    if (!Array.isArray(existing) || existing.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    const msg = (existing as any[])[0];
    if (msg.sender_id !== payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await query('DELETE FROM messages WHERE id = ?', [id]);

    return NextResponse.json({ success: true, id, room_id: msg.room_id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
