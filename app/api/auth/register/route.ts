import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, validateEmail, validatePassword, generateToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, first_name, last_name } = body;

    // Validation
    if (!email || !password || !first_name || !last_name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!validatePassword(password)) {
      return NextResponse.json(
        {
          error:
            'Password must be at least 8 characters with uppercase, lowercase, and number',
        },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = ?', [
      email,
    ]);
    if (Array.isArray(existingUser) && existingUser.length > 0) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const result = await query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
      [email, password_hash, first_name, last_name, 'admin']
    );

    const insertResult = result as any;
    const userId = insertResult.insertId;

    // Generate token
    const token = generateToken({
      id: userId,
      email,
      role: 'admin',
    });

    // Auto-add to General Room
    await addToGeneralRoom(userId, email);

    return NextResponse.json(
      {
        message: 'User registered successfully',
        token,
        user: {
          id: userId,
          email,
          first_name,
          last_name,
          role: 'admin',
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}

async function addToGeneralRoom(userId: number, email: string) {
  try {
    // 1. Find General Room
    const rooms = await query('SELECT id FROM chat_rooms WHERE name = ? LIMIT 1', ['General']);
    let roomId;

    if (Array.isArray(rooms) && rooms.length > 0) {
      roomId = (rooms[0] as any).id;
    } else {
      // 2. Create General Room if not exists (assigned to Workspace 1 by default or logic)
      // Assuming workspace_id 1 exists for now, or use first available.
      // Better: check if we have a workspace logic. For now, let's assume global or specific workspace 1.
      const result = await query(
        `INSERT INTO chat_rooms (workspace_id, name, type, description, created_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [1, 'General', 'channel', 'General discussion', userId]
      );
      roomId = (result as any).insertId;
    }

    // 3. Add User to Room
    await query(
      'INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)',
      [roomId, userId]
    );
  } catch (err) {
    console.error('Failed to add user to General room:', err);
    // Don't fail registration if this fails
  }
}
