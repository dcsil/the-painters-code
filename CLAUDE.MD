# CLAUDE.MD - AI Development Guide

This file provides context for AI assistants working on the Classroom Presentation Randomizer project.

## Project Overview

A Next.js application for university instructors to manage randomized student presentations with timing, grading, and crash recovery features. Built with TypeScript, React, SQLite, and Tailwind CSS.

## Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with @vercel/postgres (migrated from SQLite)
- **Auth**: JWT with httpOnly cookies (jose library)
- **Styling**: Tailwind CSS
- **Password Hashing**: bcryptjs
- **Deployment**: Vercel (production) with GitHub Actions CI/CD

### Key Components

#### Frontend Components (`/components`)
- **Dashboard.tsx**: Main container, orchestrates phases (Setup → Presentation → History)
- **SetupPhase.tsx**: Session creation, roster import (CSV/manual), rubric builder
- **PresentationPhase.tsx**: Team randomization, smart timer with crash recovery, grading UI
- **HistoryView.tsx**: Completed presentations, grade editing, CSV export

#### API Routes (`/app/api`)
- **auth/**: Login, signup, logout (JWT management)
- **session/**: Create sessions, get session data
- **teams/**: Add teams (bulk/individual), fetch team lists
- **rubric/**: Create criteria, save/load templates, lock rubric
- **presentations/**: Start presentation, update timer state, recovery
- **grades/**: Submit grades, edit grades (with audit trail)
- **export/**: Generate CSV exports

#### Database (`/lib/db.ts`)
- PostgreSQL connection via @vercel/postgres
- Schema initialized via `scripts/init-postgres.sql`
- Foreign key enforcement enabled
- Tables: users, sessions, teams, rubric_templates, rubric_criteria, presentations, grades, feedback, grade_audit, session_state
- All database operations are asynchronous (await required)

#### Types (`/types/index.ts`)
- Centralized TypeScript definitions for all data models

## Key Features & Implementation Details

### 1. Smart Timer System
- **Manual Start Only**: Timers never auto-start (instructor control)
- **Visual Warnings**: Green → Yellow (2min warning) → Red (overtime)
- **Overtime Tracking**: Counts into negative with clear indication
- **Crash Recovery**: Timer state saved to `session_state` table, auto-resumes on reload
- **Implementation**: PresentationPhase.tsx maintains timer state, syncs with backend every 5 seconds

### 2. Rubric Locking
- Rubric criteria can be edited during Setup Phase
- **Locks automatically** when first presentation starts (ensures fairness)
- Prevents mid-session rubric changes that would create inconsistent grading

### 3. Team Randomization
- Fair random selection from eligible pool (teams not yet presented)
- Skip/Defer returns teams to pool for later selection
- Algorithm: Fisher-Yates shuffle on eligible team IDs

### 4. Grade Audit Trail
- All grade edits logged to `grade_audit` table with timestamps
- Preserves academic integrity and accountability

### 5. CSV Import/Export
- **Import**: Flexible parsing (`Team Name, Member1, Member2, ...`)
- **Export**: Includes team info, scores per criterion, total, feedback

## Database Schema Notes

### Critical Relationships
- `sessions` → `teams` (1:many)
- `sessions` → `rubric_criteria` (1:many)
- `sessions` → `presentations` (1:many)
- `presentations` → `teams` (1:1)
- `presentations` → `grades` (1:many, one per criterion)
- `presentations` → `feedback` (1:1)

### Important Fields
- **presentations.timer_state**: JSON object with `{ presentationTimeLeft, qaTimeLeft, isInQA, isPaused }`
- **presentations.status**: 'in_progress' | 'completed'
- **rubric_criteria.is_locked**: Boolean, set when first presentation starts
- **grade_audit.edited_at**: Timestamp for grade modifications

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Functional React components with hooks
- API routes return `NextResponse` with appropriate status codes
- Database queries use async/await with @vercel/postgres
- Error handling: try/catch with meaningful error messages
- Transactions for multi-step operations (teams, grades)

### State Management
- Local component state (useState) for UI interactions
- Database as source of truth for persistent data
- Polling for timer recovery (checks session_state on mount)

### Security Considerations
- JWT stored in httpOnly cookies (prevents XSS)
- Passwords hashed with bcryptjs (never stored plain)
- API routes verify JWT before processing
- Input validation on all endpoints (team names, scores, etc.)
- SQL injection prevented by parameterized queries (@vercel/postgres tagged templates)
- Secrets stored in Vercel environment variables (never in source code)

### Common Patterns

#### API Route Structure (Postgres)
```typescript
export async function POST(request: Request) {
  try {
    // 1. Verify JWT from cookie
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Parse request body
    const data = await request.json();

    // 3. Validate input
    if (!data.requiredField) return NextResponse.json({ error: 'Missing field' }, { status: 400 });

    // 4. Database operation (async, must await)
    const result = await sql`INSERT INTO table (field) VALUES (${data.field}) RETURNING *`;
    const record = result.rows[0];

    // 5. Return response
    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

#### Transaction Pattern (for multi-step operations)
```typescript
await sql.query('BEGIN');
try {
  await sql`INSERT INTO teams ...`;
  await sql`INSERT INTO presentations ...`;
  await sql.query('COMMIT');
} catch (error) {
  await sql.query('ROLLBACK');
  throw error;
}
```

#### Component Data Fetching
```typescript
useEffect(() => {
  async function fetchData() {
    const res = await fetch('/api/endpoint');
    const data = await res.json();
    setState(data);
  }
  fetchData();
}, [dependency]);
```

## File Locations

### Adding New Features
- **New API endpoint**: Create file in `/app/api/feature-name/route.ts`
- **New component**: Add to `/components/FeatureName.tsx`
- **New types**: Add to `/types/index.ts`
- **Database changes**: Modify schema in `/lib/db.ts` (handle migrations manually)

### Configuration Files
- **Environment**: `.env.local` (JWT_SECRET)
- **TypeScript**: `tsconfig.json`
- **Tailwind**: `tailwind.config.ts`
- **Next.js**: `next.config.ts`

## Testing Scenarios

### Manual Testing Checklist
1. **Auth Flow**: Signup → Login → Dashboard access
2. **Session Creation**: Create session with valid timers
3. **Team Import**: CSV with various team sizes, manual add
4. **Rubric Creation**: Multiple criteria with weights
5. **Presentation Flow**:
   - Random team selection
   - Timer start/pause/resume
   - Switch to Q&A
   - Stop & Grade
   - Emergency Stop with defer
6. **Grading**: Valid/invalid scores, feedback submission
7. **Grade Editing**: Modify scores, verify audit trail
8. **CSV Export**: Verify all data present
9. **Crash Recovery**: Refresh during active timer
10. **Rubric Lock**: Verify lock after first presentation starts

## Common Issues & Solutions

### Database Connection Errors (Postgres)
- Ensure `POSTGRES_URL` environment variable is set correctly
- Check Vercel Postgres dashboard for connection issues
- Verify database is in same region as deployment

### Timer Drift
- Timer state synced to backend every 5 seconds
- On recovery, use server timestamp as source of truth
- Client-side countdown for smooth UX

### Rubric Lock Edge Cases
- Lock check: `SELECT rubric_locked FROM sessions WHERE session_id = ?`
- Prevent edits if rubric is locked
- UI disables rubric form when locked

## Deployment

### Local Development Setup

1. **Install Dependencies**:
```bash
npm install
```

2. **Setup Local Postgres** (for testing migration):
```bash
# Using Docker (recommended)
docker run --name classroom-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres

# Create database
psql -U postgres -c "CREATE DATABASE classroom_dev;"
```

3. **Run Migration**:
```bash
psql -U postgres -d classroom_dev -f scripts/init-postgres.sql
```

4. **Configure Environment Variables** (`.env.local`):
```
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/classroom_dev
JWT_SECRET=your-jwt-secret-here
```

5. **Start Dev Server**:
```bash
npm run dev
```

### Production Deployment (Vercel)

1. **Create Vercel Account**: Sign up at https://vercel.com with GitHub

2. **Import Repository**: Connect your GitHub repository to Vercel

3. **Create Postgres Database**:
   - Go to Storage tab in Vercel dashboard
   - Create new Postgres database
   - Connect to project
   - Run migration script in SQL editor

4. **Set Environment Variables**:
   - `JWT_SECRET`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`: Auto-provided by Vercel

5. **Deploy**: Push to main branch, Vercel auto-deploys

### GitHub Actions CI/CD

**Workflow File**: `.github/workflows/deploy.yml`

**Triggers on**: Git tags (e.g., `v1.0.0`)

**Required GitHub Secrets**:
- `VERCEL_TOKEN`: From Vercel Settings → Tokens
- `VERCEL_ORG_ID`: From `.vercel/project.json` after first deploy
- `VERCEL_PROJECT_ID`: From `.vercel/project.json` after first deploy

**To Deploy**:
```bash
git tag v1.0.0
git push origin v1.0.0
```

### Production Checklist
- [ ] Generate secure `JWT_SECRET` (32+ bytes)
- [ ] Set all environment variables in Vercel dashboard
- [ ] Set `NODE_ENV=production`
- [ ] Configure database backup strategy
- [ ] Consider SQLite file location (persistent volume)
- [ ] Test crash recovery in production environment

### Environment Variables
```
JWT_SECRET=<secure-random-string-256-bits>
NODE_ENV=production
```

## Future Enhancement Areas

### Not in MVP (Don't implement unless requested)
- Multi-instructor support (requires user_id isolation)
- Multiple concurrent sessions (currently single-session design)
- Real-time sync for projection display
- Student-facing grade portal
- Email notifications
- Advanced analytics/charts
- Mobile responsive overhaul

## Questions to Ask Before Making Changes

1. **Does this change affect grading fairness?** (e.g., rubric modifications mid-session)
2. **Will this persist across browser crashes?** (timer state, presentation status)
3. **Does this require authentication?** (all API routes except auth)
4. **Is there audit trail needed?** (grade edits, rubric changes)
5. **Could this be a security risk?** (input validation, SQL injection, XSS)

## Useful Commands

```bash
# Development
pnpm dev                  # Start dev server (http://localhost:3000)
pnpm build                # Production build
pnpm start                # Start production server
pnpm lint                 # ESLint check

# Database
# Database file: ./classroom.db
# Inspect with: sqlite3 classroom.db
# Reset DB: Delete classroom.db, restart server
```

## Contact & Maintenance

This is an MVP project for CSC491. Prioritize simplicity and reliability over feature creep. When in doubt, ask the user before adding complexity.
