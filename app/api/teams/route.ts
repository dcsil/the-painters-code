import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST: Add teams (bulk or single)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, teams } = await request.json();

    if (!sessionId || !teams || !Array.isArray(teams)) {
      return NextResponse.json({ error: 'Session ID and teams array are required' }, { status: 400 });
    }

    const addedTeams = [];
    const errors = [];

    for (const team of teams) {
      try {
        // Check for duplicate team name in this session
        const existingResult = await sql`
          SELECT id FROM teams
          WHERE session_id = ${sessionId} AND name = ${team.name}
        `;

        if (existingResult.length > 0) {
          errors.push(`Team "${team.name}" already exists`);
          continue;
        }

        // Use transaction for team + presentation creation
        await sql.begin(async sql => {
          // Insert team
          const teamResult = await sql`
            INSERT INTO teams (session_id, name, members, status)
            VALUES (${sessionId}, ${team.name}, ${JSON.stringify(team.members)}, 'pending')
            RETURNING *
          `;

          const newTeam = teamResult[0];
          addedTeams.push(newTeam);

          // Create a presentation record for this team
          await sql`
            INSERT INTO presentations (session_id, team_id, status)
            VALUES (${sessionId}, ${newTeam.id}, 'not_started')
          `;
        });
      } catch (error) {
        errors.push(`Failed to add team "${team.name}"`);
      }
    }

    return NextResponse.json({ teams: addedTeams, errors }, { status: 201 });
  } catch (error) {
    console.error('Add teams error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update team status
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId, status } = await request.json();

    await sql`UPDATE teams SET status = ${status} WHERE id = ${teamId}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
