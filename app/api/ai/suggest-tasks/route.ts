import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { suggestTasks } from '@/lib/openrouter';

const getAuthToken = (req: NextRequest) => {
  const h = req.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
};

export async function POST(req: NextRequest) {
  try {
    const token = getAuthToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { description } = body;
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Description required' }, { status: 400 });
    }

    const suggestions = await suggestTasks(description);
    return NextResponse.json({ suggestions: suggestions || [] });
  } catch (err) {
    console.error('AI suggest error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
