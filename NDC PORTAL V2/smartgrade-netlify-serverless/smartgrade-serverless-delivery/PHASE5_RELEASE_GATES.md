# Phase 5 release gates — NDC Grading Portal

Status: PREVIEW ONLY. No production deployment authorized.

## Branch divergence
On 2026-10-11, GitHub comparison showed the preview branch 13 commits ahead of main and 21 commits behind main before the CI workflow commit. Recompare before integration. Do not merge the preview branch blindly; review each overlapping file and preserve newer production fixes.

## Required release sequence
1. Reconcile main changes in a separate integration branch; inspect conflicts in auth, grading, and student recovery.
2. Run preview-only GitHub Actions session tests and review actual job logs. A committed test is not a passing test.
3. Review authorization checks for class ownership, active enrollment, and grade locks. Avoid deleting guards until equivalent central checks are covered by tests.
4. Provision an isolated PostgreSQL database with representative anonymized fixtures.
5. Apply phase5_session_version.sql and phase5_revoked_sessions.sql to the isolated database only.
6. Exercise login, logout, password reset, invalidated JWT, locked grades, teacher class ownership, student enrollment, and academic access restrictions. Confirm all tests pass.
7. Validate the password-reset email flow, audit records, role-specific dashboards, student registration, and account recovery.
8. Confirm Netlify runtime configuration, DATABASE_URL, JWT_SECRET, email settings, and CORS settings without disclosing secrets.
9. Obtain explicit approval before any production database migration, merge, or Netlify deployment.
10. If approved, back up production database, apply migrations before deploying code, perform smoke tests, and prepare a rollback plan.

## Security acceptance criteria
- Logout rejects the logged-out token on subsequent requests.
- Password reset invalidates older tokens for the same user.
- Session revocation metadata is not included in /auth/me responses.
- Cross-class teachers cannot read or modify assessments.
- Inactive students cannot submit or receive score changes.
- Finalized or released grades cannot be changed through score endpoints.
- Login and recovery failure responses do not reveal unnecessary account details.
- Existing production workflows remain unaffected.

## Deployment block
New auth middleware queries revoked_sessions and users.session_version. Deploying it without first applying both migrations would break authenticated requests. The preview branch must not be deployed directly.
