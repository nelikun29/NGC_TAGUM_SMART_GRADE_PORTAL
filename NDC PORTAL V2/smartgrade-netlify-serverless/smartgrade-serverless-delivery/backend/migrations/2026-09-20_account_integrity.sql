BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_verification_status TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS verification_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_verification_status_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_account_verification_status_check
      CHECK(account_verification_status IN ('verified','possible_duplicate','under_review','rejected'));
  END IF;
END $$;

-- Enforce email uniqueness case-insensitively. This intentionally fails if
-- preflight finds existing case-only duplicates, which must be reviewed first.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower
  ON users(LOWER(BTRIM(email)))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS student_duplicate_reviews (
  id TEXT PRIMARY KEY,
  candidate_user_id TEXT NOT NULL REFERENCES students(id),
  matched_user_id TEXT NOT NULL REFERENCES students(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','under_review','confirmed_distinct','rejected','student_id_recovered','records_consolidated')),
  match_reason TEXT NOT NULL DEFAULT 'exact_full_name',
  admin_note TEXT,
  resolved_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CHECK(candidate_user_id <> matched_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_duplicate_review_pair
  ON student_duplicate_reviews(
    LEAST(candidate_user_id, matched_user_id),
    GREATEST(candidate_user_id, matched_user_id)
  )
  WHERE status IN ('pending','under_review');

CREATE TABLE IF NOT EXISTS student_id_claims (
  id TEXT PRIMARY KEY,
  claimant_user_id TEXT NOT NULL UNIQUE REFERENCES students(id),
  claimed_student_number TEXT NOT NULL,
  current_holder_user_id TEXT NOT NULL REFERENCES students(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','under_review','approved','rejected')),
  admin_note TEXT,
  resolved_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CHECK(claimant_user_id <> current_holder_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_id_claim_active_number
  ON student_id_claims(claimed_student_number)
  WHERE status IN ('pending','under_review');

-- Backfill review cases for existing exact full-name matches with different
-- internal accounts/Student IDs. Nothing is deleted or merged.
INSERT INTO student_duplicate_reviews(
  id,candidate_user_id,matched_user_id,status,match_reason
)
SELECT
  md5(a.id || ':' || b.id),
  a.id,
  b.id,
  'pending',
  'existing_exact_full_name'
FROM students a
JOIN students b ON a.id < b.id
 AND LOWER(BTRIM(a.first_name)) = LOWER(BTRIM(b.first_name))
 AND LOWER(BTRIM(COALESCE(a.middle_name,''))) = LOWER(BTRIM(COALESCE(b.middle_name,'')))
 AND LOWER(BTRIM(a.last_name)) = LOWER(BTRIM(b.last_name))
 AND a.student_number <> b.student_number
ON CONFLICT DO NOTHING;

UPDATE users u
SET account_verification_status = 'possible_duplicate',
    verification_note = COALESCE(verification_note, 'Exact full-name match requires administrator review.'),
    updated_at = now()
WHERE u.id IN (
  SELECT candidate_user_id FROM student_duplicate_reviews WHERE status IN ('pending','under_review')
  UNION
  SELECT matched_user_id FROM student_duplicate_reviews WHERE status IN ('pending','under_review')
)
AND u.role = 'student'
AND u.account_verification_status = 'verified';

COMMIT;
