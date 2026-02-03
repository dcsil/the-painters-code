import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
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

    // Update presentation fields individually based on what's provided
    if (status !== undefined) {
      if (status === 'presenting') {
        await sql`
          UPDATE presentations
          SET status = ${status}, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${presentationId}
        `;
      } else if (status === 'completed') {
        await sql`
          UPDATE presentations
          SET status = ${status}, ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${presentationId}
        `;
      } else {
        await sql`
          UPDATE presentations
          SET status = ${status}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${presentationId}
        `;
      }
    }

    if (presentationTimeElapsed !== undefined) {
      await sql`
        UPDATE presentations
        SET presentation_time_elapsed = ${presentationTimeElapsed}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${presentationId}
      `;
    }

    if (qaTimeElapsed !== undefined) {
      await sql`
        UPDATE presentations
        SET qa_time_elapsed = ${qaTimeElapsed}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${presentationId}
      `;
    }

    if (timerState !== undefined) {
      await sql`
        UPDATE presentations
        SET timer_state = ${JSON.stringify(timerState)}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${presentationId}
      `;
    }

    // Update team status if teamId is provided
    if (teamId !== undefined && status !== undefined) {
      const teamStatus = status === 'completed' ? 'completed' : status === 'presenting' ? 'presenting' : 'pending';
      await sql`UPDATE teams SET status = ${teamStatus} WHERE id = ${teamId}`;
    }

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
    const pendingTeamsResult = await sql`
      SELECT * FROM teams
      WHERE session_id = ${sessionId} AND status = 'pending'
    `;
    const pendingTeams = pendingTeamsResult;

    if (pendingTeams.length === 0) {
      return NextResponse.json({ error: 'No pending teams available' }, { status: 404 });
    }

    // Select a random team
    const randomIndex = Math.floor(Math.random() * pendingTeams.length);
    const selectedTeam = pendingTeams[randomIndex] as any;

    // Check if presentation already exists for this team
    const presentationResult = await sql`
      SELECT * FROM presentations WHERE team_id = ${selectedTeam.id}
    `;
    let presentation = presentationResult[0];

    // Create presentation record if it doesn't exist
    if (!presentation) {
      const newPresentationResult = await sql`
        INSERT INTO presentations (session_id, team_id)
        VALUES (${sessionId}, ${selectedTeam.id})
        RETURNING *
      `;
      presentation = newPresentationResult[0];
    }

    return NextResponse.json({ team: selectedTeam, presentation });
  } catch (error) {
    console.error('Get random team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete presentation record (used when deferring a team)
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { presentationId } = await request.json();

    if (!presentationId) {
      return NextResponse.json({ error: 'Presentation ID required' }, { status: 400 });
    }

    // Delete the presentation record (cascade will handle related grades/feedback)
    await sql`DELETE FROM presentations WHERE id = ${presentationId}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete presentation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
