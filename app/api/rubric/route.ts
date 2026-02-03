import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST: Add rubric criteria to session
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, criteria } = await request.json();

    if (!sessionId || !criteria || !Array.isArray(criteria)) {
      return NextResponse.json({ error: 'Session ID and criteria array are required' }, { status: 400 });
    }

    // Check if rubric is locked
    const sessionDataResult = await sql`
      SELECT rubric_locked FROM sessions WHERE id = ${sessionId}
    `;
    const sessionData = sessionDataResult[0];

    if (sessionData?.rubric_locked) {
      return NextResponse.json({ error: 'Rubric is locked' }, { status: 400 });
    }

    const addedCriteria = [];

    // Use transaction for inserting all criteria
    await sql.begin(async sql => {
      for (let i = 0; i < criteria.length; i++) {
        const criterion = criteria[i];
        const result = await sql`
          INSERT INTO rubric_criteria (session_id, name, description, max_score, weight, order_index)
          VALUES (${sessionId}, ${criterion.name}, ${criterion.description || ''}, ${criterion.maxScore}, ${criterion.weight || 100}, ${i})
          RETURNING *
        `;

        addedCriteria.push(result[0]);
      }
    });

    return NextResponse.json({ criteria: addedCriteria }, { status: 201 });
  } catch (error) {
    console.error('Add criteria error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Get rubric templates
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templatesResult = await sql`
      SELECT * FROM rubric_templates
      WHERE user_id = ${session.userId}
      ORDER BY created_at DESC
    `;
    const templates = templatesResult;

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
