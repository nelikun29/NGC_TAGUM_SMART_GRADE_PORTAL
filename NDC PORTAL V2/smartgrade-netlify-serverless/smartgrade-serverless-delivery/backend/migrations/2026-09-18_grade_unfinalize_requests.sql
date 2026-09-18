-- Teacher -> Admin workflow for reopening finalized/released learner grades.
-- Additive and backward-compatible: no existing grade records are modified.
CREATE TABLE IF NOT EXISTS grade_unfinalize_requests (
  id UUID PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  requested_status TEXT NOT NULL CHECK (requested_status IN ('finalized','released')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_grade_unfinalize_pending
  ON grade_unfinalize_requests(class_id,student_id)
  WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_grade_unfinalize_teacher_status
  ON grade_unfinalize_requests(teacher_id,status,requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_grade_unfinalize_status_requested
  ON grade_unfinalize_requests(status,requested_at DESC);
