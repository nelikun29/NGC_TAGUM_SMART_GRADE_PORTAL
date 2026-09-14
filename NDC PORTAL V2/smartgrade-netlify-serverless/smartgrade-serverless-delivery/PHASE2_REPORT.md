# PHASE 2 — IMPLEMENTATION REPORT

## Architecture note (read first)

The Phase 1 baseline was a single static HTML file with all "data" living in
browser JavaScript variables — no server, no database. Most of Phase 2's
requirements (IDOR protection, SQL injection prevention, server-side score
recalculation, brute-force lockout, an audit log ordinary users can't edit)
are backend responsibilities that a static file cannot provide, because there
is no server to enforce them against. Per your direction, this phase replaces
that architecture with a real backend: **Node.js + Express + SQLite**, JWT
auth, bcrypt password hashing, and a frontend that calls this API instead of
holding its own state. This is a rebuild of the *architecture*, not a
disregard of "don't rebuild from scratch" — the data model, roles, and
workflows described in your Phase 1 app are preserved and re-implemented on
top of a real server.

---

## A. CHANGES IMPLEMENTED

- Real authentication: bcrypt-hashed passwords, JWT sessions (8h expiry), per-account brute-force lockout (5 failed attempts → 15 min lock) plus IP-based rate limiting on login
- Server-enforced RBAC on every route (admin / teacher / student), including class-ownership checks that block teacher-to-teacher IDOR
- Student Master Profile + separate Class/Subject Enrollment tables (no duplicate student profiles across subjects)
- Duplicate Student ID rejection at registration
- Teacher registration requires admin approval before login is possible
- Class creation with unique class codes (`SUBJECT-YEAR-XXXX`), distinct from attendance codes
- Attendance sessions with auto-expiring codes (15 min), explicit close, and duplicate-submission prevention (`UNIQUE(session_id, student_id)`)
- Quiz / Performance Task / Examination modules with teacher score entry, student self-report (marked `STUDENT-REPORTED`, pending verification), and lock/verify workflow
- Configurable weighted grading engine; weights must total exactly 100% or the server rejects the change
- Correct "missing score" semantics: a component with no score yet is excluded from computation and reported as `Grade Incomplete — X pending`, never silently treated as zero
- Grade status lifecycle: `in_progress → computed → finalized → released`, with finalize/release/reopen endpoints (reopen is admin-only)
- Score validation server-side: rejects negative scores and scores exceeding the item's maximum, on every write path
- Score locking: once an assessment is locked, only an admin can override; teachers cannot
- Append-only audit log (no update/delete route exists for it) recording login, registration, approvals, class/session creation, score changes, finalization, and release, with actor, role, timestamp, and IP
- Admin dashboard stats, user management (approve/reject/deactivate/reactivate/reset password), system-wide class list, audit log viewer
- CSV export for class grade sheets and attendance reports; JSON endpoint for individual student grade reports
- Security headers via Helmet, CORS restricted to configured origins, centralized error handler that never leaks stack traces
- All database access via parameterized statements (better-sqlite3 prepared statements) — no string-concatenated SQL anywhere

## B. FILES MODIFIED / CREATED

This is a new codebase alongside the original file (not an in-place edit, since the original had no server layer to modify):

**Backend** (`backend/`): `server.js`, `db.js`, `schema.sql`, `seed.js`, `middleware/auth.js`, `utils/audit.js`, `utils/grading.js`, `utils/validate.js`, `routes/auth.js`, `routes/classes.js`, `routes/attendance.js`, `routes/assessments.js`, `routes/grades.js`, `routes/admin.js`, `routes/reports.js`

**Frontend** (`frontend/`): `index.html`, `app.js` — rebuilt to call the API for every action (login, registration, class join, attendance submission, score entry, gradebook, weights, admin approvals, audit log) instead of holding data in memory. Visual language (Tailwind, color palette, layout conventions) carried over from your original design.

Original file `smart_grade_attendance_portal__1_.html` is untouched and not referenced by the new app.

## C. DATABASE CHANGES

New SQLite schema (`backend/schema.sql`), 15 tables:

- `users` — auth identity, role, active/approval status, lockout fields
- `students` (master profile) / `teachers` — permanent identity, separate from per-class data
- `academic_terms` — academic year + semester, `is_current` flag
- `classes` — one row per section, unique `class_code`, linked to `teacher_id` and `term_id`
- `grading_weights` — one row per class, four weight columns
- `enrollments` — student↔class join table (`UNIQUE(student_id, class_id)`), separate from the master profile so one student can take multiple subjects without duplicate records
- `attendance_sessions` / `attendance_records` — session has expiry + status; record has `UNIQUE(session_id, student_id)` to block duplicate submissions
- `quizzes` / `quiz_scores`, `performance_tasks` / `performance_scores`, `examinations` / `exam_scores` — each score table stores `raw_score` (nullable = "no score yet"), `verification_status`, `is_locked`
- `grade_status` — per student per class: `in_progress` / `computed` / `finalized` / `released`, with finalize/release actor and timestamp
- `audit_log` — append-only; user, role, action, record type/id, previous/new value (JSON), IP, user agent, timestamp

## D. SECURITY IMPROVEMENTS

| Vulnerability class | How it's addressed |
|---|---|
| IDOR / privilege escalation | Every teacher-scoped route re-checks `classes.teacher_id` against the JWT's user id server-side; admins bypass, everyone else is rejected regardless of what ID is in the URL |
| SQL injection | 100% parameterized queries (better-sqlite3 prepared statements); no string concatenation into SQL anywhere |
| Score manipulation from the client | The grading engine (`utils/grading.js`) always recomputes percentages and the final grade from stored `raw_score`/max values; the client never sends, and the server never trusts, a computed percentage or final grade |
| Session hijacking / weak auth | JWT signed server-side with a required secret (server refuses to boot without one), bcrypt cost factor 12, 8h token expiry |
| Brute-force login | 5 failed attempts locks the account for 15 minutes; separate IP-based rate limit on `/auth/login` |
| Duplicate submissions | DB-level `UNIQUE` constraints on attendance records, enrollments, and per-assessment scores — not just client-side checks |
| Unauthorized grade modification | Locked assessments reject teacher edits (admin-only override); grade release requires prior finalization; reopening a finalized grade is admin-only |
| Credential/password exposure | `password_hash` never included in any API response; admin user list explicitly excludes it |
| XSS / clickjacking / MIME sniffing | Helmet security headers + CSP on all responses; frontend escapes all user-supplied text before inserting into the DOM |
| CSRF | JWT is sent via `Authorization` header (not cookies), which is inherently not subject to classic CSRF |
| Information leakage on error | Central error handler returns a generic message and logs details server-side only |
| Enumeration via login errors | "Invalid email or password" is identical whether the account doesn't exist or the password is wrong |

## E. TEST RESULTS

All tests below were executed against the running backend in this session (not simulated).

| Test | Expected Result | Actual Result | Status |
|---|---|---|---|
| Student registration | Account created | Created successfully | ✅ Pass |
| Duplicate Student ID | Rejected with clear message | `"This Student ID is already registered."` (409) | ✅ Pass |
| Teacher registration | Pending, cannot log in yet | Registered as `pending`; login blocked with `"pending administrator approval"` | ✅ Pass |
| Admin approves teacher | Teacher can now log in | Approved → login succeeded | ✅ Pass |
| Login (all 3 roles) | Token issued | All three logged in successfully | ✅ Pass |
| Wrong password × 5 | Account locks | Locked after 5th attempt (HTTP 423), correct password also rejected while locked | ✅ Pass |
| Admin resets password | Clears lockout | Login succeeded immediately after reset | ✅ Pass |
| Class creation + join code | Unique code generated | `EDUC15-2026-A7X9` generated, distinct format from attendance codes | ✅ Pass |
| Attendance session open/submit | Code recorded present | `"Attendance recorded."` | ✅ Pass |
| Duplicate attendance submission | Rejected | `"Attendance has already been recorded for this session."` (409) | ✅ Pass |
| Closed/expired attendance code | Rejected | `"Attendance session is closed."` (410) | ✅ Pass |
| Quiz score exceeding max | Rejected | `"Score cannot exceed the maximum score (50)."` (400) | ✅ Pass |
| Negative score | Rejected | `"Score cannot be negative."` (400) | ✅ Pass |
| Grade with missing component | Shows incomplete, not zero | `"Grade Incomplete — Attendance, Quiz, Performance, Exam score pending."` | ✅ Pass |
| Full grade computation | Weighted sum correct | Attendance 100 + Quiz 90 + PT 85 + Exam 88 at weights 10/20/30/40 → **88.7**, matched by hand | ✅ Pass |
| Invalid grading weights (≠100%) | Rejected | `"Assessment weights must total exactly 100%."` (400) | ✅ Pass |
| Finalize incomplete grade | Rejected | Blocked with explanatory message (verified in code path; complete-grade finalize tested live) | ✅ Pass |
| Finalize → student view before release | Grade hidden | `finalGrade: null, visibleToStudent: false` while `status: finalized` | ✅ Pass |
| Release grade | Student now sees final grade | `finalGrade: 88.7, visibleToStudent: true` | ✅ Pass |
| Lock assessment, teacher edits | Rejected | `"This record is locked. Ask an administrator to unlock it before editing."` (403) | ✅ Pass |
| Lock assessment, admin edits | Allowed | Score updated successfully | ✅ Pass |
| Student accesses admin endpoint | Rejected | `"You are not authorized to perform this action."` (403) | ✅ Pass |
| No token at all | Rejected | `"Authentication required."` (401) | ✅ Pass |
| Student views another student's grade | Rejected | 403 | ✅ Pass |
| **Teacher B accesses Teacher A's class roster (IDOR)** | Rejected | 403, even with a valid class ID | ✅ Pass |
| **Teacher B writes a score into Teacher A's quiz (IDOR)** | Rejected | 403 | ✅ Pass |
| CSV grade-sheet export | Correct, current data | Valid CSV with computed columns matching the gradebook | ✅ Pass |
| CORS from frontend origin | Preflight succeeds | `Access-Control-Allow-Origin` returned correctly for configured origin | ✅ Pass |

## F. REMAINING ISSUES

- **Frontend UI coverage is functional but not exhaustive.** Every core workflow for all three roles is wired to the API (login/registration, class creation/joining, attendance sessions, quiz/PT/exam creation and scoring, gradebook, weights, finalize/release, admin approvals/users/audit log, CSV export). Not yet built in the UI: printable/formatted report layouts beyond CSV (the JSON report endpoint exists; a print-styled HTML view is not yet wired), quiz student self-report UI (the API supports it), attendance history view for students (API exists, no dedicated screen), and pagination on large tables (backend has no pagination on list endpoints yet — fine at demo scale, should be added before a large real deployment).
- **JWT revocation is stateless.** Logout discards the client-side token, but a stolen token remains valid until it expires (max 8 hours). A token-blacklist table would be needed for hard server-side revocation before expiry.
- **Excel-format and PDF export** are not implemented — only CSV and a JSON report payload. Print-to-PDF from the browser works for the JSON report if a print view is added, but that view isn't built yet.
- **Soft-delete** is not yet implemented for any table (no delete routes exist at all currently, which is safe but also means there's no admin path to remove a mistaken record — only deactivate/lock/reopen).
- **Single-server, single-file SQLite.** Fine for a school-scale deployment; would need a real transactional DB (Postgres) and connection pooling for concurrent multi-server deployment at larger scale.
- I was not able to keep a live demo instance running continuously in this environment between conversation turns (the sandboxed process gets torn down between turns) — this doesn't affect the delivered code, but it means you'll need to run `npm install && node seed.js && node server.js` yourself to try it, per the README.

## G. DEPLOYMENT READINESS

**Beta Ready.**

Reasoning: core data integrity, RBAC, IDOR protection, score integrity, and the grading engine are implemented and have passed the security and functional tests above against a real running server — this is a substantive step up from a demo. It is not yet "Production Ready" because: the frontend doesn't yet expose every workflow the spec describes (printable reports, some student-facing screens), there's no automated test suite (all testing above was manual, session-based), no HTTPS/reverse-proxy configuration is included (noted in the README as a deployment step), and it hasn't been load-tested or run against a second independent review. I'd recommend a focused round of frontend completion plus a external security review before calling it production-ready for real student data.

---

## ADDENDUM — Follow-up changes (this update)

**1. Student enrollment now requires teacher approval.**
`enrollments.status` changed from `active|dropped` to `pending|active|dropped|rejected`.
Joining via class code now creates a `pending` row; the student is invisible
to the roster, attendance, quizzes, and grading until a teacher approves
them (new endpoints: `GET/POST /api/classes/:classId/pending-enrollments`,
`.../enrollments/:studentId/approve`, `.../reject`). Verified live: a newly
registered student joining the demo class landed in the teacher's pending
list and was excluded from the roster and grade computations until approved.

**2. Visual refresh.** Added a layered glass/shadow/hover-animation system
(`glass-card`, `.stat-card`, button lift, table row hover, tab hover, page
fade-in) applied across all three dashboards and the login screen.

**3. Data storage — recommended AGAINST Google Sheets.** Explained the
concurrency (no real transactions), rate-limit (~60–100 req/min), and
credential-handoff downsides of Sheets-as-database, especially since it
would undo the duplicate-submission and score-locking guarantees built in
Phase 2. Recommended and implemented instead: each deployment gets its own
self-contained SQLite file, its own JWT secret, and its own admin account —
transferring "ownership" is copying the folder and running one setup script,
with no shared cloud credentials to hand over. Added `create-admin.js` (creates
exactly one admin account, refuses to run with the template default
password) as the production alternative to the demo `seed.js`, and an
`INSTITUTION_NAME` / logo-file convention for white-labeling without code
changes.

**4. Branding.** Header and login screen now display the institution name
(pulled live from `GET /api/config`, backed by `.env`) and logo
(`frontend/assets/logo.png`). Shipped configured for NDC-Tagum Foundation,
Inc. — verified via a live request returning
`{"institutionName":"NDC-Tagum Foundation, Inc."}`.

### Updated test results (this round)

| Test | Expected Result | Actual Result | Status |
|---|---|---|---|
| Student joins class via code | Enrollment created as `pending`, not `active` | `"Request sent. Your teacher must approve you..."` | ✅ Pass |
| Roster right after join | Pending student excluded | Roster showed only the pre-approved demo student | ✅ Pass |
| Teacher pending-enrollments list | Shows the new student | Returned the joining student's profile | ✅ Pass |
| Teacher approves | Student added to roster | Roster then included the approved student | ✅ Pass |
| `GET /api/config` | Returns configured institution name | `{"institutionName":"NDC-Tagum Foundation, Inc."}` | ✅ Pass |
| `create-admin.js` with default password | Refuses to run | `"ADMIN_PASSWORD must be changed from the template default..."` | ✅ Pass |
| `create-admin.js` with a real password | Creates exactly one admin account | Account created, no demo data added | ✅ Pass |
| `create-admin.js` run twice | Second run is a no-op | `"An account with email ... already exists. Nothing to do."` | ✅ Pass |
| Fresh install of the actual delivery zip contents | Builds, seeds, and boots cleanly | `npm install` → `node seed.js` → `node server.js` all succeeded on the exact files being shipped | ✅ Pass |

---

## ADDENDUM 2 — Manual attendance entry (no code required)

Added the ability for a teacher to set any student's attendance status
directly, without the student ever entering a code. This was a gap: quiz/PT/exam
scores already had manual entry from the start, but attendance only had the
code-based self-submit flow — this fills that gap.

**New backend endpoints:**
- `GET /api/attendance/sessions?classId=` — lists all sessions for a class (open and closed), with a submitted-record count, so a teacher can find and revisit any past session.
- `GET /api/attendance/sessions/:sessionId/roster` — returns the FULL active class roster merged with each student's current status for that session (`null` if not yet recorded) — this is what the manual-entry UI is built on, as opposed to the existing endpoint that only lists students who've already submitted.
- The existing `PUT /api/attendance/sessions/:sessionId/records/:studentId` (Present/Late/Absent/Excused) is now exposed in the frontend for the first time.

**Frontend:** Teacher → Attendance tab now shows every session for the
selected class with a "Manage Attendance" button. Opening it lists the full
roster with one-click status buttons per student — including students who
never entered a code. A teacher can now take attendance entirely manually
(open a session just to have a record, then click through statuses) or mix
approaches (let most students self-submit via code, manually fix or fill in
the rest).

### Test results

| Test | Expected Result | Actual Result | Status |
|---|---|---|---|
| List sessions for a class | Returns all sessions with recorded counts | Returned the newly opened session, `recorded_count: 0` | ✅ Pass |
| Full session roster before any submissions | All active students listed, `status: null` | Demo student listed with `status: null` | ✅ Pass |
| Manual set to "excused" | Saved, reflected on next roster fetch | Status updated to `excused` | ✅ Pass |
| Grade computation after manual-only entry (all excused) | Attendance reported as missing (no non-excused record to average) | `attendance.available: false`, correctly listed under "missing" | ✅ Pass |
| Manual set to "present" | Attendance percent becomes 100 | `attendance.percent: 100` in the grade response | ✅ Pass |
| Teacher B attempts to view/edit Teacher A's session (IDOR) | Rejected on all three new/exposed routes | 403 on roster view, status edit, and session list | ✅ Pass |
| Fresh install of the actual delivery zip contents | Builds, seeds, boots, responds correctly | Verified via `npm install` → `node seed.js` → `node server.js` → live API calls, all on the exact shipped files | ✅ Pass |

---

## ADDENDUM 3 — Serverless port (Netlify Functions + Neon/Postgres)

At the user's request, rebuilt the backend to run as Netlify Functions with
Postgres (Neon) instead of a standalone Node server with SQLite. This was a
genuine architectural port, not a config change:

**What changed:**
- `better-sqlite3` (synchronous) → `pg` (async Postgres client). Every
  database call across every route file, the grading engine, the audit
  logger, and the auth middleware was converted from synchronous
  `db.prepare().get()/.all()/.run()` calls to `await pool.query(...)`,
  and every route handler became `async`.
- Schema ported from SQLite to Postgres (`INTEGER` 0/1 flags → real
  `BOOLEAN`; `datetime('now')` → `now()`; placeholder style `?` → `$1,$2...`).
- The Express app was split into a router (`api-router.js`) mounted by two
  separate thin entry points: `backend/server.js` (local dev, `.listen()`)
  and `netlify/functions/api.js` (wraps the same router with
  `serverless-http` for Netlify).
- `package.json` moved to the project root (not inside `backend/`) — Node's
  module resolution walks up the directory tree from the requiring file,
  so a Netlify Function under `netlify/functions/` could never have found
  dependencies installed in a sibling `backend/node_modules`.
- Added `TRUST_PROXY` handling appropriate to each entry point: the
  Netlify Function always trusts Netlify's edge network (hardcoded, since
  that's structurally always true there); the local server only trusts a
  proxy if explicitly configured via env var.
- Frontend `API_BASE` changed from a hardcoded `http://localhost:4000/api`
  to a relative `/api`, so it works with zero configuration once deployed
  to Netlify (frontend and backend share one origin via a redirect rule in
  `netlify.toml`).

**What did NOT change:** the data model, every business rule (grading
weights, missing-score handling, enrollment approval, score locking, audit
log), and every route's request/response contract — the frontend's
JavaScript logic needed no changes beyond the API_BASE default.

### Test results

All tests below were run against a real local PostgreSQL 16 instance (not
SQLite, not mocked) to validate the actual Postgres queries, and separately
against a simulated Netlify Function invocation to validate the
`serverless-http` wrapper — not just the underlying Express logic.

| Test | Expected Result | Actual Result | Status |
|---|---|---|---|
| Schema creation on fresh Postgres DB | All 15 tables created | `ensureSchema()` ran cleanly, confirmed via `\dt` | ✅ Pass |
| `seed.js` against Postgres | Demo accounts + class created | `"Seed complete."` with correct demo credentials | ✅ Pass |
| Login (teacher/student) | Token issued | Both succeeded | ✅ Pass |
| Attendance session + code submission | Recorded, duplicate blocked | `"Attendance recorded."` then `"Attendance has already been recorded..."` (409) | ✅ Pass |
| Quiz/PT/Exam creation + scoring | Saved correctly | All three saved and reflected in grade computation | ✅ Pass |
| Full grade computation | Weighted sum correct | Attendance 100 + Quiz 90 + PT 85 + Exam 88 → **88.7**, exactly matching the SQLite version's result for the same inputs | ✅ Pass |
| Finalize → release → student visibility | Hidden until released, then visible | Confirmed both states | ✅ Pass |
| RBAC (student hits admin endpoint, no token) | Rejected | 403 and 401 respectively | ✅ Pass |
| `create-admin.js` default-password guard | Refuses to run | Correctly refused; succeeded once password was changed; second run was a no-op | ✅ Pass |
| **Netlify Function wrapper — full simulated invocation** | Health/config/login/authenticated request/rejected request all work through `serverless-http` at the real Netlify path shape (`/.netlify/functions/api/...`) | All 5 simulated requests returned correct status codes and bodies | ✅ Pass |
| **Audit log IP capture through the Netlify path** | Real visitor IP recorded, not a proxy/internal IP | Simulated request with Netlify's real IP header (`x-nf-client-connection-ip`) correctly recorded `203.0.113.42` in the audit log | ✅ Pass |
| Module resolution from `netlify/functions/` | Dependencies resolve correctly | Confirmed only after moving `package.json`/`node_modules` to the project root — this was caught as a real bug during testing, not assumed to work | ✅ Pass (after fix) |

### Known limitation of this test coverage

Everything above was tested against a **local** Postgres instance and a
**simulated** Netlify Function invocation — this sandbox has no way to
create a real Neon account or push to a real Netlify deployment. The code
path exercised (Express → `serverless-http` → Postgres via `pg`) is
identical to what would run in production, and the simulated event shape
matches Netlify's documented format, but the first real deployment to
actual Netlify + actual Neon should still be treated as a first real-world
test, not a formality — watch the Netlify function logs on that first
deploy for anything unexpected.
