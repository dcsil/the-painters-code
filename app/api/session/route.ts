import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { Session } from '@/types';

// GET: Get or create current session
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the most recent session for this user
    const currentSession = db
      .prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(session.userId) as Session | undefined;

    if (!currentSession) {
      return NextResponse.json({ session: null }, { status: 200 });
    }

    // Get teams for this session
    const teams = db
      .prepare('SELECT * FROM teams WHERE session_id = ? ORDER BY created_at')
      .all(currentSession.id);

    // Get rubric criteria
    const criteria = db
      .prepare('SELECT * FROM rubric_criteria WHERE session_id = ? ORDER BY order_index')
      .all(currentSession.id);

    // Get presentations
    const presentations = db
      .prepare('SELECT * FROM presentations WHERE session_id = ?')
      .all(currentSession.id);

    return NextResponse.json({
      session: currentSession,
      teams,
      criteria,
      presentations,
    });
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create new session
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, presentationDuration, qaDuration } = await request.json();

    if (!name || !presentationDuration || !qaDuration) {
      return NextResponse.json(
        { error: 'Name, presentation duration, and QA duration are required' },
        { status: 400 }
      );
    }

    const result = db
      .prepare(
        'INSERT INTO sessions (user_id, name, presentation_duration, qa_duration) VALUES (?, ?, ?, ?)'
      )
      .run(session.userId, name, presentationDuration, qaDuration);

    const sessionId = result.lastInsertRowid as number;

    const newSession = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(sessionId) as Session;

    return NextResponse.json({ session: newSession }, { status: 201 });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update session
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, rubricLocked } = await request.json();

    db.prepare('UPDATE sessions SET rubric_locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(rubricLocked ? 1 : 0, sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete session (cascade deletes all related data)
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Verify session belongs to user
    const sessionData = db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, session.userId);

    if (!sessionData) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
    }

    // Delete session (cascades to all related data due to foreign key constraints)
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
