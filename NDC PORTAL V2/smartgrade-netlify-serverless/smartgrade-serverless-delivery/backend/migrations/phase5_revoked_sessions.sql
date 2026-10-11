-- Phase 5: apply only to an isolated test database until deployment approval.
-- SHA-256 hashes only; never store raw bearer tokens.
CREATE TABLE IF NOT EXISTS revoked_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires_at ON revoked_sessions(expires_at);
-- Optional maintenance (schedule separately): DELETE FROM revoked_sessions WHERE expires_at < now();
