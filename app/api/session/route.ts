import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
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
    const sessionResult = await sql`
      SELECT * FROM sessions
      WHERE user_id = ${session.userId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const currentSession = sessionResult[0] as Session | undefined;

    if (!currentSession) {
      return NextResponse.json({ session: null }, { status: 200 });
    }

    // Get teams for this session
    const teamsResult = await sql`
      SELECT * FROM teams
      WHERE session_id = ${currentSession.id}
      ORDER BY created_at
    `;
    const teams = teamsResult;

    // Get rubric criteria
    const criteriaResult = await sql`
      SELECT * FROM rubric_criteria
      WHERE session_id = ${currentSession.id}
      ORDER BY order_index
    `;
    const criteria = criteriaResult;

    // Get presentations
    const presentationsResult = await sql`
      SELECT * FROM presentations
      WHERE session_id = ${currentSession.id}
    `;
    const presentations = presentationsResult;

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

    const result = await sql`
      INSERT INTO sessions (user_id, name, presentation_duration, qa_duration)
      VALUES (${session.userId}, ${name}, ${presentationDuration}, ${qaDuration})
      RETURNING *
    `;

    const newSession = result[0] as Session;

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

    await sql`
      UPDATE sessions
      SET rubric_locked = ${rubricLocked ? true : false},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sessionId}
    `;

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
    const sessionDataResult = await sql`
      SELECT * FROM sessions
      WHERE id = ${sessionId} AND user_id = ${session.userId}
    `;

    if (sessionDataResult.length === 0) {
      return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
    }

    // Delete session (cascades to all related data due to foreign key constraints)
    await sql`DELETE FROM sessions WHERE id = ${sessionId}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
