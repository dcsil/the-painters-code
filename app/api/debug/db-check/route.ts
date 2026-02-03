import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    // Check if we can connect to the database
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    // Try to count users (should work even if table is empty)
    let userCount = 0;
    try {
      const result = await sql`SELECT COUNT(*) as count FROM users`;
      userCount = parseInt(result[0].count);
    } catch (e) {
      // Table might not exist
    }

    return NextResponse.json({
      success: true,
      connected: true,
      tables: tables.map((t: any) => t.table_name),
      userCount,
      environment: {
        isVercel: !!process.env.VERCEL,
        hasPostgresUrl: !!process.env.POSTGRES_URL,
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: error.message,
      environment: {
        isVercel: !!process.env.VERCEL,
        hasPostgresUrl: !!process.env.POSTGRES_URL,
      }
    }, { status: 500 });
  }
}
