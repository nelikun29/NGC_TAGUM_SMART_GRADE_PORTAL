-- Apply to isolated test database first. Required before deploying Phase 5 auth changes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
-- Password reset increments this value to invalidate all earlier JWTs.
