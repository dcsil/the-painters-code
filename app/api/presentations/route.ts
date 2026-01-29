import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

// PATCH: Update presentation state
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      presentationId,
      teamId,
      status,
      presentationTimeElapsed,
      qaTimeElapsed,
      timerState
    } = await request.json();

    const updates: string[] = [];
    const values: any[] = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);

      // Update started_at when status changes to presenting
      if (status === 'presenting') {
        updates.push('started_at = CURRENT_TIMESTAMP');
      }

      // Update ended_at when status changes to completed
      if (status === 'completed') {
        updates.push('ended_at = CURRENT_TIMESTAMP');
      }
    }

    if (presentationTimeElapsed !== undefined) {
      updates.push('presentation_time_elapsed = ?');
      values.push(presentationTimeElapsed);
    }

    if (qaTimeElapsed !== undefined) {
      updates.push('qa_time_elapsed = ?');
      values.push(qaTimeElapsed);
    }

    if (timerState !== undefined) {
      updates.push('timer_state = ?');
      values.push(JSON.stringify(timerState));
    }

    // Update team status if teamId is provided
    if (teamId !== undefined && status !== undefined) {
      db.prepare('UPDATE teams SET status = ? WHERE id = ?').run(status === 'completed' ? 'completed' : status === 'presenting' ? 'presenting' : 'pending', teamId);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(presentationId);

    db.prepare(
      `UPDATE presentations SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update presentation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Get random team for presentation
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();

    // Get all pending teams
    const pendingTeams = db
      .prepare('SELECT * FROM teams WHERE session_id = ? AND status = ?')
      .all(sessionId, 'pending');

    if (pendingTeams.length === 0) {
      return NextResponse.json({ error: 'No pending teams available' }, { status: 404 });
    }

    // Select a random team
    const randomIndex = Math.floor(Math.random() * pendingTeams.length);
    const selectedTeam = pendingTeams[randomIndex] as any;

    // Check if presentation already exists for this team
    let presentation = db
      .prepare('SELECT * FROM presentations WHERE team_id = ?')
      .get(selectedTeam.id);

    // Create presentation record if it doesn't exist
    if (!presentation) {
      const result = db
        .prepare('INSERT INTO presentations (session_id, team_id) VALUES (?, ?)')
        .run(sessionId, selectedTeam.id);

      presentation = db
        .prepare('SELECT * FROM presentations WHERE id = ?')
        .get(result.lastInsertRowid as number);
    }

    return NextResponse.json({ team: selectedTeam, presentation });
  } catch (error) {
    console.error('Get random team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
