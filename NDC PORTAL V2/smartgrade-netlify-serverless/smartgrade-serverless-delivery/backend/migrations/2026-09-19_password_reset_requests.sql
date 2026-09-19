-- Admin-assisted Forgot Password v1
-- Non-destructive. Adds password reset requests only.
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','dismissed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT REFERENCES users(id),
  UNIQUE(user_id, status)
);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status_requested
  ON password_reset_requests(status, requested_at DESC);
