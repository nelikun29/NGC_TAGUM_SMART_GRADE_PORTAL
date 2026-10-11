# Phase 5 security validation — preview only

Scope: `phase5-security-hardening-preview`. Do not merge, deploy, or run migrations against production without approval.

## Architecture notes

- `backend/api-router.js` mounts `assessment-guard` before `routes/assessments`. The centralized guard already checks class access, active enrollment for score changes, and finalized/released grade status.
- The additional `requireClassAccess` and `requireActiveEnrollment` functions introduced in the Phase 5 assessment route patch duplicate some of these checks. Consolidate them in a reviewed change; do not remove centralized protections.
- `/auth/logout` audits logout but does not revoke existing JWTs. Any revocation change needs an explicit design, persistence, and migration review.
- Password-reset requests now have a five-minute per-account pending-request cooldown. Confirm rate limits across parallel requests and serverless instances.
- `api-router.js` reads forwarded IP headers in the global rate-limiter key generator. Confirm trusted proxy behavior before relying on IP limits.

## Regression matrix (isolated test database only)

| Scenario | Expected result |
|---|---|
| Student requests assessments for another class | 403 |
| Teacher requests assessments for a class they do not own | 403 |
| Authorized teacher requests own class assessments | 200 |
| Active enrolled student requests their class assessment metadata | 200 |
| Teacher writes a score for a student not actively enrolled | Denied; no score row created |
| Teacher writes an enrolled student's valid score | Saved; audit event recorded |
| Teacher attempts to change a finalized/released grade | 409; unchanged |
| Admin reopens grade through existing approved workflow | Existing behavior preserved |
| Student self-reports an unverified quiz score | Pending teacher verification |
| Student tries to overwrite a verified quiz score | Denied |
| Password-reset request for nonexistent email | Same generic response as existing email |
| Second reset request within five minutes | Generic response; no additional email |
| Valid reset token used once | Password changed; token cannot be reused |
| Reset token expired | Rejected |
| Deactivated account uses previously issued JWT | Rejected |
| Logged-out JWT reused | Currently a known gap; must fail after revocation feature is designed and implemented |
| Desktop and mobile teacher gradebook | Existing score entry, navigation, and save feedback work |

## Release gates

1. Remove redundant authorization logic only after tests demonstrate that the central guard protects every relevant route.
2. Review DB migration strategy for session revocation; do not silently change existing account schemas.
3. Run unit and integration tests with nonproduction data and role-specific fixtures.
4. Validate grade computation and finalization flows; verify audit logging and concurrent writes.
5. Obtain explicit authorization before any merge, deployment, or database migration.

Status: checklist authored; no runtime tests executed by this document.
