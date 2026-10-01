-- Email password recovery v2
-- Adds one-time reset token metadata to existing password_reset_requests.
ALTER TABLE password_reset_requests
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_password_reset_requests_token_hash
  ON password_reset_requests(token_hash)
  WHERE token_hash IS NOT NULL;
