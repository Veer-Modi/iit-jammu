import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePasswords, generateToken, validateEmail } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Find user (trial_ends_at may not exist in older schemas)
    let users: any[];
    try {
      users = await query(
        'SELECT id, email, password_hash, first_name, last_name, role, is_active, trial_ends_at FROM users WHERE email = ?',
        [email]
      ) as any[];
    } catch {
      users = await query(
        'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = ?',
        [email]
      ) as any[];
    }

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = users[0] as any;

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    // Check trial expiry (if trial_ends_at exists and is set)
    if (user.trial_ends_at) {
      const endsAt = new Date(user.trial_ends_at);
      if (endsAt.getTime() < Date.now()) {
        return NextResponse.json(
          { error: 'Your 7-day trial has ended. Please upgrade to continue.' },
          { status: 403 }
        );
      }
    }

    // Verify password
    const isPasswordValid = await comparePasswords(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [
      user.id,
    ]);

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json(
      {
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          trial_ends_at: user.trial_ends_at || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
