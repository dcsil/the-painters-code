# Classroom Presentation Randomizer

A command center dashboard for university instructors to manage high-stakes student presentations with randomization, timing, and grading capabilities.

## Features

### Setup Phase
- **Session Management**: Create sessions with configurable presentation and Q&A durations
- **Roster Import**:
  - Bulk CSV import (Team Name, Member1, Member2, ...)
  - Manual team entry
  - Duplicate team name prevention
- **Rubric Builder**:
  - Create custom grading criteria with max scores and weights
  - Save and load rubric templates
  - Rubric locks after first presentation starts (ensures fairness)

### Presentation Phase
- **Random Team Selection**: Fair randomization from eligible pool
- **Smart Timer System**:
  - Manual start (never auto-starts)
  - Visual warnings at 2-minute mark
  - Overtime tracking (counts into negative with clear indication)
  - Separate presentation and Q&A timers
  - Browser crash recovery (auto-resumes from saved state)
- **Flexible Controls**:
  - Skip/Defer absent teams (returns them to pool)
  - Emergency Stop with resume or restart options
  - Stop & Grade for early finishes
- **Grading Interface**:
  - Score entry with validation (0 to max score)
  - Auto-calculated total scores
  - Public feedback (student-visible) and private notes
  - Cannot submit invalid scores

### History & Management
- **View Completed Presentations**: See all graded teams with scores and feedback
- **Edit Grades**: Modify scores/notes for any completed presentation
- **Audit Trail**: Timestamps logged when grades are edited
- **CSV Export**: Download all grades with team info and feedback

### Persistence
- **PostgreSQL Database**: All data persists in cloud-hosted database
- **Browser Crash Recovery**: Automatically resume active presentations with exact timer state
- **Cloud-Deployed**: Accessible from anywhere with internet connection

## Tech Stack

- **Frontend**: Next.js 15 (React) with TypeScript
- **Backend**: Next.js API Routes (Node.js)
- **Database**: PostgreSQL with @vercel/postgres
- **Styling**: Tailwind CSS
- **Authentication**: JWT with httpOnly cookies
- **Deployment**: Vercel with GitHub Actions CI/CD

## Production Deployment

**Live URL**: [Deployed on Vercel](https://your-app.vercel.app) _(URL will be available after deployment)_

## Getting Started (Local Development)

### Prerequisites
- Node.js 18+
- npm (or pnpm/yarn)
- Docker (for local Postgres) OR PostgreSQL installed locally

### Local Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd the-painters-code
```

2. Install dependencies:
```bash
npm install
```

3. Setup Local Postgres:
```bash
# Option A: Using Docker (recommended)
docker run --name classroom-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres

# Create database
psql -U postgres -c "CREATE DATABASE classroom_dev;"

# Run migration
psql -U postgres -d classroom_dev -f scripts/init-postgres.sql
```

4. Set up environment variables (`.env.local`):
```env
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/classroom_dev
JWT_SECRET=your-secure-random-string-here
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### First Time Setup

1. Navigate to the signup page and create an account
2. Login with your credentials
3. Create a new session with:
   - Session name (e.g., "CSC491 Week 5")
   - Presentation duration (minutes)
   - Q&A duration (minutes)
4. Add teams using bulk CSV or manual entry
5. Create rubric criteria or load from a saved template
6. Click "Start Presentation Session"

## Usage Guide

### Adding Teams (Bulk CSV)
Format each line as: `Team Name, Member1, Member2, Member3, ...`

Example:
```
Team Alpha, Alice Smith, Bob Jones
Team Beta, Carol White, Dave Brown, Eve Green
Team Gamma, Frank Miller
```

### During Presentations

1. **Pick Next Team**: Randomly selects from eligible pool
2. **Start Presentation**: Manually start the timer
3. **Monitor Timer**:
   - Green = plenty of time
   - Yellow = 2 minutes warning
   - Red = overtime
4. **Controls**:
   - **Switch to Q&A**: End presentation phase, start Q&A
   - **Stop & Grade**: For early finishes or end of Q&A
   - **Emergency Stop**: Pause with option to resume or defer
5. **Grade**: Fill in scores, add feedback, submit
6. **Repeat**: Pick next team when ready

### Skip/Defer Scenarios

- **Team Absent**: Click team, then use defer to return them to pool
- **Technical Issues**: Emergency Stop → Defer (they can go later)
- **Student Emergency**: Emergency Stop → option to restart or defer

### Editing Grades

1. Go to "View History"
2. Find the presentation
3. Click "Edit Grades"
4. Modify scores/feedback
5. Save (creates audit trail entry)

### Exporting Data

1. Go to "View History"
2. Click "Export to CSV"
3. Downloads file with all team scores and feedback

## Project Structure

```
the-painters-code/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── session/      # Session management
│   │   ├── teams/        # Team operations
│   │   ├── rubric/       # Rubric and templates
│   │   ├── presentations/# Presentation state
│   │   ├── grades/       # Grading operations
│   │   └── export/       # CSV export
│   ├── dashboard/        # Main dashboard page
│   ├── login/            # Login page
│   ├── signup/           # Signup page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home (redirects)
│   └── globals.css       # Global styles
├── components/
│   ├── Dashboard.tsx     # Main dashboard container
│   ├── SetupPhase.tsx    # Session/roster/rubric setup
│   ├── PresentationPhase.tsx # Randomizer, timer, grading
│   └── HistoryView.tsx   # Completed presentations
├── lib/
│   ├── db.ts             # Postgres connection (@vercel/postgres)
│   └── auth.ts           # JWT utilities
├── types/
│   └── index.ts          # TypeScript type definitions
├── scripts/
│   └── init-postgres.sql # Database schema migration
├── .github/
│   └── workflows/
│       └── deploy.yml    # GitHub Actions deployment workflow
└── docs/
    ├── deployment-justification.md  # Architecture decisions
    └── architecture-diagram.png     # System architecture diagram
```

## Database Schema

### Tables
- **users**: Instructor accounts
- **sessions**: Presentation sessions with timer configs
- **teams**: Team rosters with members
- **rubric_templates**: Saved rubric configurations
- **rubric_criteria**: Session-specific grading criteria
- **presentations**: Presentation records with timer state
- **grades**: Individual criterion scores
- **feedback**: Public and private feedback
- **grade_audit**: Edit history for grades
- **session_state**: Recovery state for browser crashes

## Development

### Build for Production
```bash
npm run build
npm start
```

### Type Checking
```bash
npx tsc --noEmit
```

### Linting
```bash
npm run lint
```

## Deployment

### Vercel Deployment (Production)

1. **Create Vercel Account**: Sign up at https://vercel.com
2. **Import Repository**: Connect GitHub repository to Vercel
3. **Create Postgres Database**:
   - Go to Storage tab in Vercel dashboard
   - Create new Postgres database
   - Connect to project
   - Run `scripts/init-postgres.sql` in SQL editor
4. **Set Environment Variables** in Vercel dashboard:
   - `JWT_SECRET`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`: Auto-provided by Vercel
5. **Deploy**: Push to main branch, Vercel auto-deploys

### GitHub Actions CI/CD

**Workflow**: `.github/workflows/deploy.yml`

**Triggers**: Git tags (e.g., `v1.0.0`)

**Setup GitHub Secrets** (in repo Settings → Secrets → Actions):
- `VERCEL_TOKEN`: From Vercel Settings → Tokens
- `VERCEL_ORG_ID`: From `.vercel/project.json` after first manual deploy
- `VERCEL_PROJECT_ID`: From `.vercel/project.json`

**To Deploy via Workflow**:
```bash
git tag v1.0.0
git push origin v1.0.0
```

Workflow will automatically trigger and deploy to production.

## Security Notes

- JWT tokens stored in httpOnly cookies (XSS protection)
- Passwords hashed with bcryptjs
- Database uses foreign keys and constraints
- Input validation on all API endpoints
- Change JWT_SECRET for production deployments

## Future Enhancements (Not in MVP)

- Multi-instructor support with isolated data
- Multiple concurrent sessions
- Real-time presentation view for projection
- Student-facing grade viewing portal
- Advanced analytics and reporting
- Email notifications
- Mobile responsive improvements

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.