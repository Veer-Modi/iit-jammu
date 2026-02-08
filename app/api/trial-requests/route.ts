import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { sendTrialApproved } from '@/lib/email';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'taskflow-admin-secret-change-me';

function getAuth(req: NextRequest): { isAdmin: boolean } {
  const key = req.headers.get('x-admin-key') || req.nextUrl.searchParams.get('adminKey');
  return { isAdmin: key === ADMIN_SECRET };
}

export async function GET(req: NextRequest) {
  const { isAdmin } = getAuth(req);
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await query(
      'SELECT id, email, first_name, last_name, company_name, status, created_at FROM trial_requests ORDER BY created_at DESC'
    );
    return NextResponse.json(rows || []);
  } catch (err) {
    console.error('Trial requests fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, first_name, last_name, password, company_name } = body;

    if (!email || !first_name || !last_name || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await query('SELECT id FROM trial_requests WHERE email = ?', [email]);
    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: 'Email already requested trial' }, { status: 409 });
    }

    const password_hash = await hashPassword(password);
    await query(
      'INSERT INTO trial_requests (email, first_name, last_name, password_hash, company_name) VALUES (?, ?, ?, ?, ?)',
      [email, first_name, last_name, password_hash, company_name || null]
    );

    return NextResponse.json({ message: 'Trial request submitted. We will notify you once approved.' }, { status: 201 });
  } catch (err) {
    console.error('Trial request error:', err);
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { isAdmin } = getAuth(req);
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, action } = body; // action: 'approve' | 'reject'

    if (!id || !action) return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });

    const rows = await query('SELECT * FROM trial_requests WHERE id = ?', [id]);
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const row = rows[0] as any;

    if (action === 'reject') {
      await query('UPDATE trial_requests SET status = ? WHERE id = ?', ['rejected', id]);
      return NextResponse.json({ message: 'Rejected' });
    }

    if (action === 'approve') {
      // Create user if not exists
      const existingUser = await query('SELECT id FROM users WHERE email = ?', [row.email]);
      let userId: number;

      if (Array.isArray(existingUser) && existingUser.length > 0) {
        userId = (existingUser[0] as any).id;
        await query(
          'UPDATE users SET trial_ends_at = DATE_ADD(NOW(), INTERVAL 7 DAY), is_trial_approved = TRUE WHERE id = ?',
          [userId]
        );
      } else {
        const ins = await query(
          'INSERT INTO users (email, password_hash, first_name, last_name, role, is_trial_approved, trial_ends_at) VALUES (?, ?, ?, ?, ?, TRUE, DATE_ADD(NOW(), INTERVAL 7 DAY))',
          [row.email, row.password_hash, row.first_name, row.last_name, 'admin']
        );
        userId = (ins as any).insertId;

        // Create default workspace
        const ws = await query('INSERT INTO workspaces (owner_id, name, description) VALUES (?, ?, ?)', [
          userId,
          'My Workspace',
          'Your first workspace',
        ]);
        const wsId = (ws as any).insertId;
        await query('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)', [wsId, userId, 'admin']);

        // General room
        const gr = await query(
          'INSERT INTO chat_rooms (workspace_id, name, type, description, created_by) VALUES (?, ?, ?, ?, ?)',
          [wsId, 'General', 'channel', 'General discussion', userId]
        );
        const grId = (gr as any).insertId;
        await query('INSERT INTO chat_room_members (room_id, user_id) VALUES (?, ?)', [grId, userId]);
      }

      await query('UPDATE trial_requests SET status = ?, approved_at = NOW() WHERE id = ?', ['approved', id]);

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await sendTrialApproved(row.email, row.first_name, `${baseUrl}/auth/login`);

      return NextResponse.json({ message: 'Approved. User can now log in.', userId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Trial approve error:', err);
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
  }
}
