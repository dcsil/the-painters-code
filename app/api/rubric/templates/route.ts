import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

// POST: Save rubric template
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, criteria } = await request.json();

    if (!name || !criteria) {
      return NextResponse.json({ error: 'Name and criteria are required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO rubric_templates (user_id, name, criteria)
      VALUES (${session.userId}, ${name}, ${JSON.stringify(criteria)})
      RETURNING *
    `;

    const template = result[0];

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Save template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
