import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'classroom.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      presentation_duration INTEGER NOT NULL DEFAULT 10,
      qa_duration INTEGER NOT NULL DEFAULT 5,
      rubric_locked BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Teams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      members TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      UNIQUE(session_id, name)
    )
  `);

  // Rubric templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rubric_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      criteria TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Rubric criteria table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rubric_criteria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      max_score REAL NOT NULL,
      weight REAL NOT NULL DEFAULT 100,
      order_index INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // Add description column if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE rubric_criteria ADD COLUMN description TEXT DEFAULT ''`);
  } catch (error) {
    // Column already exists, ignore
  }

  // Presentations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS presentations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      started_at DATETIME,
      ended_at DATETIME,
      presentation_time_elapsed INTEGER NOT NULL DEFAULT 0,
      qa_time_elapsed INTEGER NOT NULL DEFAULT 0,
      timer_state TEXT,
      status TEXT NOT NULL DEFAULT 'not_started',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    )
  `);

  // Grades table
  db.exec(`
    CREATE TABLE IF NOT EXISTS grades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presentation_id INTEGER NOT NULL,
      criterion_id INTEGER NOT NULL,
      score REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE,
      FOREIGN KEY (criterion_id) REFERENCES rubric_criteria(id) ON DELETE CASCADE,
      UNIQUE(presentation_id, criterion_id)
    )
  `);

  // Feedback table
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      presentation_id INTEGER NOT NULL,
      public_feedback TEXT NOT NULL DEFAULT '',
      private_notes TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE,
      UNIQUE(presentation_id)
    )
  `);

  // Grade audit trail table
  db.exec(`
    CREATE TABLE IF NOT EXISTS grade_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grade_id INTEGER NOT NULL,
      old_score REAL NOT NULL,
      new_score REAL NOT NULL,
      edited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE
    )
  `);

  // Session state table for recovery
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      state TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      UNIQUE(session_id)
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_teams_session ON teams(session_id);
    CREATE INDEX IF NOT EXISTS idx_presentations_session ON presentations(session_id);
    CREATE INDEX IF NOT EXISTS idx_presentations_team ON presentations(team_id);
    CREATE INDEX IF NOT EXISTS idx_grades_presentation ON grades(presentation_id);
    CREATE INDEX IF NOT EXISTS idx_rubric_criteria_session ON rubric_criteria(session_id);
  `);
}

// Initialize the database on import
initializeDatabase();

export default db;
