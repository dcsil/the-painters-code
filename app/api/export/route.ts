import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { Team, RubricCriterion, Presentation, Grade, Feedback } from '@/types';

export async function GET(request: Request) {
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

    // Get all completed presentations with their teams
    const presentations = db
      .prepare(`
        SELECT p.*, t.name as team_name, t.members
        FROM presentations p
        JOIN teams t ON p.team_id = t.id
        WHERE p.session_id = ? AND p.status = 'completed'
        ORDER BY t.name
      `)
      .all(sessionId) as any[];

    // Get rubric criteria
    const criteria = db
      .prepare('SELECT * FROM rubric_criteria WHERE session_id = ? ORDER BY order_index')
      .all(sessionId) as RubricCriterion[];

    // Build CSV
    const headers = ['Team Name', 'Members', ...criteria.map(c => c.name), 'Total Score', 'Public Feedback', 'Private Notes'];
    const rows = [headers.join(',')];

    for (const presentation of presentations) {
      const grades = db
        .prepare('SELECT * FROM grades WHERE presentation_id = ?')
        .all(presentation.id) as Grade[];

      const feedback = db
        .prepare('SELECT * FROM feedback WHERE presentation_id = ?')
        .get(presentation.id) as Feedback | undefined;

      const members = JSON.parse(presentation.members).join('; ');
      const scoreMap = new Map(grades.map(g => [g.criterion_id, g.score]));
      const scores = criteria.map(c => scoreMap.get(c.id) || 0);
      const totalScore = scores.reduce((sum, score) => sum + score, 0);

      const row = [
        `"${presentation.team_name}"`,
        `"${members}"`,
        ...scores,
        totalScore,
        `"${feedback?.public_feedback || ''}"`,
        `"${feedback?.private_notes || ''}"`
      ];

      rows.push(row.join(','));
    }

    const csv = rows.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="grades-${sessionId}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export grades error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
