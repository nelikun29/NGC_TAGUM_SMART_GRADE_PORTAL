-- Single-device persistent session support
-- Additive migration. Existing accounts start unbound and will bind to the
-- first device that successfully signs in after deployment.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_device_hash TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_device_bound_at TIMESTAMPTZ;
