// User authentication
export interface User {
  id: number;
  email: string;
  password: string;
  created_at: string;
}

// Session state management
export interface Session {
  id: number;
  user_id: number;
  name: string;
  presentation_duration: number; // minutes
  qa_duration: number; // minutes
  rubric_locked: boolean;
  created_at: string;
  updated_at: string;
}

// Team management
export interface Team {
  id: number;
  session_id: number;
  name: string;
  members: string; // JSON array of member names
  status: 'pending' | 'presenting' | 'completed' | 'deferred';
  created_at: string;
}

// Rubric templates
export interface RubricTemplate {
  id: number;
  user_id: number;
  name: string;
  criteria: string; // JSON array of criteria objects
  created_at: string;
}

// Rubric criteria for a session
export interface RubricCriterion {
  id: number;
  session_id: number;
  name: string;
  description?: string;
  max_score: number;
  weight: number; // percentage weight
  order_index: number;
  created_at: string;
}

// Team presentations
export interface Presentation {
  id: number;
  session_id: number;
  team_id: number;
  started_at: string | null;
  ended_at: string | null;
  presentation_time_elapsed: number; // seconds
  qa_time_elapsed: number; // seconds
  timer_state: string | null; // JSON object for recovery
  status: 'not_started' | 'presenting' | 'qa' | 'completed' | 'emergency_stopped';
  created_at: string;
  updated_at: string;
}

// Grading
export interface Grade {
  id: number;
  presentation_id: number;
  criterion_id: number;
  score: number;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: number;
  presentation_id: number;
  public_feedback: string;
  private_notes: string;
  created_at: string;
  updated_at: string;
}

// Audit trail for grade edits
export interface GradeAudit {
  id: number;
  grade_id: number;
  old_score: number;
  new_score: number;
  edited_at: string;
}

// Session recovery state
export interface SessionState {
  id: number;
  session_id: number;
  state: string; // JSON object with full state
  updated_at: string;
}

// Frontend types
export interface TeamWithMembers extends Team {
  membersList: string[];
}

export interface CriterionWithScore extends RubricCriterion {
  score?: number;
}

export interface PresentationWithDetails extends Presentation {
  team: TeamWithMembers;
  grades: Grade[];
  feedback: Feedback | null;
}
