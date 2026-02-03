import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
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

    // Use transaction for all grade updates + feedback
    try {
      await sql.begin(async sql => {
        // Insert or update grades
        for (const grade of grades) {
          const existingResult = await sql`
            SELECT id, score FROM grades
            WHERE presentation_id = ${presentationId} AND criterion_id = ${grade.criterionId}
          `;

          if (existingResult.length > 0) {
            const oldGrade = existingResult[0];
            // Create audit entry
            await sql`
              INSERT INTO grade_audit (grade_id, old_score, new_score)
              VALUES (${oldGrade.id}, ${oldGrade.score}, ${grade.score})
            `;

            // Update grade
            await sql`
              UPDATE grades
              SET score = ${grade.score}, updated_at = CURRENT_TIMESTAMP
              WHERE id = ${oldGrade.id}
            `;
          } else {
            // Insert new grade
            await sql`
              INSERT INTO grades (presentation_id, criterion_id, score)
              VALUES (${presentationId}, ${grade.criterionId}, ${grade.score})
            `;
          }
        }

        // Insert or update feedback
        const existingFeedbackResult = await sql`
          SELECT id FROM feedback WHERE presentation_id = ${presentationId}
        `;

        if (existingFeedbackResult.length > 0) {
          await sql`
            UPDATE feedback
            SET public_feedback = ${publicFeedback || ''},
                private_notes = ${privateNotes || ''},
                updated_at = CURRENT_TIMESTAMP
            WHERE presentation_id = ${presentationId}
          `;
        } else {
          await sql`
            INSERT INTO feedback (presentation_id, public_feedback, private_notes)
            VALUES (${presentationId}, ${publicFeedback || ''}, ${privateNotes || ''})
          `;
        }
      });

      return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
      throw error;
    }
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

    const gradesResult = await sql`
      SELECT * FROM grades WHERE presentation_id = ${presentationId}
    `;
    const grades = gradesResult;

    const feedbackResult = await sql`
      SELECT * FROM feedback WHERE presentation_id = ${presentationId}
    `;
    const feedback = feedbackResult[0];

    return NextResponse.json({ grades, feedback });
  } catch (error) {
    console.error('Get grades error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
