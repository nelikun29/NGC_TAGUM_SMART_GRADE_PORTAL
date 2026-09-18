# QR Attendance v1 — Staging Verification

This branch adds QR-based attendance as a secure alternative entry mechanism while preserving the existing Attendance Code workflow.

## Staging checks

- Teacher can create and close the existing attendance session.
- Existing Attendance Code remains functional.
- Teacher can display a rotating signed QR code for an open session.
- QR contains a short-lived session credential and no learner identity.
- Student QR submission requires authentication and active enrollment.
- Closed or expired sessions reject QR submissions.
- Duplicate attendance submissions are rejected.
- Finalized or released grades remain protected from attendance changes.
- Successful QR check-in writes to the existing attendance record as Present.

No database migration is required for QR Attendance v1.
