import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST: Submit grades for a presentation
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { presentationId, grades, publicFeedback, privateNotes } = await request.json();

    if (!presentationId || !grades || !Array.isArray(grades)) {
      return NextResponse.json(
        { error: 'Presentation ID and grades array are required' },
        { status: 400 }
      );
    }

    // Insert or update grades
    for (const grade of grades) {
      const existing = db
        .prepare('SELECT id, score FROM grades WHERE presentation_id = ? AND criterion_id = ?')
        .get(presentationId, grade.criterionId);

      if (existing) {
        const oldGrade = existing as any;
        // Create audit entry
        db.prepare(
          'INSERT INTO grade_audit (grade_id, old_score, new_score) VALUES (?, ?, ?)'
        ).run(oldGrade.id, oldGrade.score, grade.score);

        // Update grade
        db.prepare(
          'UPDATE grades SET score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(grade.score, oldGrade.id);
      } else {
        // Insert new grade
        db.prepare(
          'INSERT INTO grades (presentation_id, criterion_id, score) VALUES (?, ?, ?)'
        ).run(presentationId, grade.criterionId, grade.score);
      }
    }

    // Insert or update feedback
    const existingFeedback = db
      .prepare('SELECT id FROM feedback WHERE presentation_id = ?')
      .get(presentationId);

    if (existingFeedback) {
      db.prepare(
        'UPDATE feedback SET public_feedback = ?, private_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE presentation_id = ?'
      ).run(publicFeedback || '', privateNotes || '', presentationId);
    } else {
      db.prepare(
        'INSERT INTO feedback (presentation_id, public_feedback, private_notes) VALUES (?, ?, ?)'
      ).run(presentationId, publicFeedback || '', privateNotes || '');
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Submit grades error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Get grades for a presentation
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const presentationId = searchParams.get('presentationId');

    if (!presentationId) {
      return NextResponse.json({ error: 'Presentation ID is required' }, { status: 400 });
    }

    const grades = db
      .prepare('SELECT * FROM grades WHERE presentation_id = ?')
      .all(presentationId);

    const feedback = db
      .prepare('SELECT * FROM feedback WHERE presentation_id = ?')
      .get(presentationId);

    return NextResponse.json({ grades, feedback });
  } catch (error) {
    console.error('Get grades error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
