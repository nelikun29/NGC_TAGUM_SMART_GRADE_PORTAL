-- SMART GRADE & ATTENDANCE PORTAL — PHASE 2 SCHEMA (PostgreSQL / Neon)
-- Ported from the original SQLite schema. IDs are text (UUIDs generated in
-- application code, same as before) rather than serial, so no behavior
-- changes there. Booleans use real BOOLEAN type where SQLite used INTEGER
-- 0/1 flags; application code reads these as JS true/false now instead of
-- 1/0 — see the "Behavior changes vs the SQLite version" note in MIGRATION.md.

-- ===================== USERS / AUTH =====================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  approval_status TEXT NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('pending','approved','rejected')),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  student_number TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  year_level TEXT NOT NULL,
  room_number TEXT
);

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  department TEXT
);

-- ===================== ACADEMIC STRUCTURE =====================

CREATE TABLE IF NOT EXISTS academic_terms (
  id TEXT PRIMARY KEY,
  academic_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(academic_year, semester)
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  subject TEXT NOT NULL,
  section TEXT NOT NULL,
  year_level TEXT NOT NULL,
  room_number TEXT,
  term_id TEXT NOT NULL REFERENCES academic_terms(id),
  class_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grading_weights (
  class_id TEXT PRIMARY KEY REFERENCES classes(id) ON DELETE CASCADE,
  attendance_weight NUMERIC NOT NULL DEFAULT 10,
  quiz_weight NUMERIC NOT NULL DEFAULT 20,
  performance_weight NUMERIC NOT NULL DEFAULT 30,
  exam_weight NUMERIC NOT NULL DEFAULT 40
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','dropped','rejected')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, class_id)
);

-- ===================== ATTENDANCE =====================

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  session_date TEXT NOT NULL,
  attendance_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES attendance_sessions(id),
  student_id TEXT NOT NULL REFERENCES students(id),
  status TEXT NOT NULL CHECK(status IN ('present','late','absent','excused')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by TEXT NOT NULL,
  UNIQUE(session_id, student_id)
);

-- ===================== QUIZZES =====================

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  title TEXT NOT NULL,
  description TEXT,
  quiz_date TEXT,
  total_items NUMERIC NOT NULL,
  passing_score NUMERIC,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS quiz_scores (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  student_id TEXT NOT NULL REFERENCES students(id),
  raw_score NUMERIC,
  source TEXT NOT NULL DEFAULT 'teacher' CHECK(source IN ('teacher','student_reported')),
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK(verification_status IN ('pending','verified','rejected')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, student_id)
);

-- ===================== PERFORMANCE TASKS =====================

CREATE TABLE IF NOT EXISTS performance_tasks (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  title TEXT NOT NULL,
  description TEXT,
  task_date TEXT,
  max_score NUMERIC NOT NULL,
  rubric TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS performance_scores (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES performance_tasks(id),
  student_id TEXT NOT NULL REFERENCES students(id),
  raw_score NUMERIC,
  remarks TEXT,
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK(verification_status IN ('pending','verified','rejected')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, student_id)
);

-- ===================== EXAMINATIONS =====================

CREATE TABLE IF NOT EXISTS examinations (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES classes(id),
  title TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  exam_date TEXT,
  total_items NUMERIC NOT NULL,
  max_score NUMERIC NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS exam_scores (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES examinations(id),
  student_id TEXT NOT NULL REFERENCES students(id),
  raw_score NUMERIC,
  remarks TEXT,
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK(verification_status IN ('pending','verified','rejected')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(exam_id, student_id)
);

-- ===================== GRADE STATUS =====================

CREATE TABLE IF NOT EXISTS grade_status (
  student_id TEXT NOT NULL REFERENCES students(id),
  class_id TEXT NOT NULL REFERENCES classes(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','computed','finalized','released')),
  finalized_by TEXT,
  finalized_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  PRIMARY KEY (student_id, class_id)
);

-- ===================== AUDIT LOG =====================

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT,
  action TEXT NOT NULL,
  record_type TEXT,
  record_id TEXT,
  previous_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_attrec_session ON attendance_records(session_id);
