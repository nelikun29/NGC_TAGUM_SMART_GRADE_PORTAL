# Account Integrity v1 deployment runbook

Do not deploy the frontend/backend commit before the database migration is
successfully applied. The application code reads the new verification columns
on login and in Admin Users.

## 1. Read-only Neon preflight

Check for case-only email duplicates before creating the case-insensitive
unique index:

```sql
SELECT LOWER(BTRIM(email)) AS normalized_email,
       COUNT(*) AS account_count,
       ARRAY_AGG(id ORDER BY created_at) AS user_ids
FROM users
WHERE email IS NOT NULL
GROUP BY LOWER(BTRIM(email))
HAVING COUNT(*) > 1;
```

The result must be empty. If it is not empty, review those accounts before
running the migration; do not delete either account automatically.

Preview exact-name matches that will become review cases:

```sql
SELECT a.id AS account_a, a.student_number AS student_id_a,
       b.id AS account_b, b.student_number AS student_id_b,
       a.last_name, a.first_name, a.middle_name
FROM students a
JOIN students b ON a.id < b.id
 AND LOWER(BTRIM(a.first_name)) = LOWER(BTRIM(b.first_name))
 AND LOWER(BTRIM(COALESCE(a.middle_name,''))) = LOWER(BTRIM(COALESCE(b.middle_name,'')))
 AND LOWER(BTRIM(a.last_name)) = LOWER(BTRIM(b.last_name))
 AND a.student_number <> b.student_number
ORDER BY a.last_name, a.first_name;
```

## 2. Apply the migration

Run `backend/migrations/2026-09-20_account_integrity.sql` as one transaction.
It creates review cases and flags matching existing learners; it does not
delete, merge, or move academic records.

## 3. Deploy the single verified application commit

Confirm the Netlify site is connected to:

- Branch: `account-recovery-production-v1`
- Base directory: `NDC PORTAL V2/smartgrade-netlify-serverless/smartgrade-serverless-delivery`
- Publish directory: `frontend`
- Functions directory: `netlify/functions`

Verify the deploy log shows the intended commit SHA before opening the Admin
Users page. Do not deploy or merge `main` as part of this release.

## 4. Smoke tests

1. Existing Admin can open Users.
2. Names are uppercase and family-name first.
3. Student ID and account search are visible.
4. Unfinalized, Correct Role, Reset Password, and Deactivate/Reactivate remain.
5. A same-name/different-ID registration is flagged and sees only the
   verification-status screen.
6. Duplicate Student ID and duplicate email registrations return `409`.
7. Admin can inspect both accounts' record counts before resolving a case.
8. Confirm-distinct, reject, and Student-ID recovery actions create audit rows.

## Stolen Student ID recovery

When Student A has accounts using both `0001` and Student B's official `0002`:

1. Student B selects **Student ID already used? Claim your ID** and submits a
   claim for `0002`.
2. Student B receives a restricted placeholder account. Student B can sign in
   only to see verification status.
3. Admin opens **Review ID Claim** and compares Student B with the current
   holder, including all academic-record counts.
4. Admin identifies who owns every record currently attached to the holder:
   Student B, Student A's legitimate `0001` account, or nobody if there are no
   academic records.
5. Approval runs one database transaction. It first checks for enrollment,
   attendance, assessment, grade, adjustment, and unfinalize-request conflicts.
6. If no conflicts exist, all holder records move to the selected verified
   owner, the former holder is archived/deactivated, and `0002` is assigned to
   Student B.

If record ownership is mixed, do not approve the claim. Resolve individual
records first. The workflow intentionally refuses partial or conflicting
automatic merges and never deletes either account.
