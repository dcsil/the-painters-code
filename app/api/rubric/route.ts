import { NextResponse } from 'next/server';
import db from '@/lib/db';
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
    const sessionData = db.prepare('SELECT rubric_locked FROM sessions WHERE id = ?').get(sessionId) as any;
    if (sessionData?.rubric_locked) {
      return NextResponse.json({ error: 'Rubric is locked' }, { status: 400 });
    }

    const addedCriteria = [];

    for (let i = 0; i < criteria.length; i++) {
      const criterion = criteria[i];
      const result = db
        .prepare(
          'INSERT INTO rubric_criteria (session_id, name, description, max_score, weight, order_index) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(
          sessionId,
          criterion.name,
          criterion.description || '',
          criterion.maxScore,
          criterion.weight || 100,
          i
        );

      const criterionId = result.lastInsertRowid as number;
      const newCriterion = db.prepare('SELECT * FROM rubric_criteria WHERE id = ?').get(criterionId);
      addedCriteria.push(newCriterion);
    }

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

    const templates = db
      .prepare('SELECT * FROM rubric_templates WHERE user_id = ? ORDER BY created_at DESC')
      .all(session.userId);

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
