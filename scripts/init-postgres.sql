-- PostgreSQL Schema Migration for Classroom Presentation Randomizer
-- Converted from SQLite schema in lib/db.ts

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  presentation_duration INTEGER NOT NULL DEFAULT 10,
  qa_duration INTEGER NOT NULL DEFAULT 5,
  rubric_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  members TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE(session_id, name)
);

-- Rubric templates table
CREATE TABLE IF NOT EXISTS rubric_templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  criteria TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rubric criteria table
CREATE TABLE IF NOT EXISTS rubric_criteria (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  max_score NUMERIC NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 100,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Presentations table
CREATE TABLE IF NOT EXISTS presentations (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  presentation_time_elapsed INTEGER NOT NULL DEFAULT 0,
  qa_time_elapsed INTEGER NOT NULL DEFAULT 0,
  timer_state TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  presentation_id INTEGER NOT NULL,
  criterion_id INTEGER NOT NULL,
  score NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE,
  FOREIGN KEY (criterion_id) REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  UNIQUE(presentation_id, criterion_id)
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  presentation_id INTEGER NOT NULL,
  public_feedback TEXT NOT NULL DEFAULT '',
  private_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE,
  UNIQUE(presentation_id)
);

-- Grade audit trail table
CREATE TABLE IF NOT EXISTS grade_audit (
  id SERIAL PRIMARY KEY,
  grade_id INTEGER NOT NULL,
  old_score NUMERIC NOT NULL,
  new_score NUMERIC NOT NULL,
  edited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE
);

-- Session state table for recovery
CREATE TABLE IF NOT EXISTS session_state (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  state TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE(session_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_session ON teams(session_id);
CREATE INDEX IF NOT EXISTS idx_presentations_session ON presentations(session_id);
CREATE INDEX IF NOT EXISTS idx_presentations_team ON presentations(team_id);
CREATE INDEX IF NOT EXISTS idx_grades_presentation ON grades(presentation_id);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_session ON rubric_criteria(session_id);
