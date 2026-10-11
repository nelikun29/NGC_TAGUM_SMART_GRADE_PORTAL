# Mobile grades, classes, and attendance performance review

## Confirmed code-path bottleneck
Student.render() fetched /classes, then fetched each enrolled class grade sequentially. For N classes, this added N serial network round trips and per-grade database work. The preview branch now loads at most 3 class grades concurrently, retaining display order and existing per-class fallback behavior.

## Additional findings (not yet changed)
- GET /grades/:classId and /grades/:classId/gradebook call getClassGradebook(), which computes each enrolled student's grade using Promise.all without a concurrency bound. Large classes may saturate the PostgreSQL pool (max 5 per function instance). Benchmark before modifying grade calculations.
- GET /attendance/sessions and the compatibility endpoint perform a correlated COUNT of attendance_records per session; evaluate EXPLAIN ANALYZE and indexing on attendance_records(session_id), attendance_sessions(class_id,session_date).
- GET /classes computes two correlated enrollment counts per class. Consider grouped counts and supporting enrollments(class_id,status) index after query-plan review.
- Netlify function wrapper calls ensureSingleDeviceSessionSchema() before every request, cached per instance. Cold starts may issue ALTER TABLE statements. Move schema changes into an explicit migration only after verifying production schema state and migration execution procedure.
- External browser Tailwind CDN and QR libraries contribute startup network dependencies. Audit mobile waterfall and defer QR libraries until QR screen is used.
- Notification polling is already 5 minutes, not a high-frequency loop.

## Required validation before deployment
1. Check JavaScript syntax and exercise student class rendering with 0, 1, and 10+ enrolled classes, pending enrollments, 401 session expiry, failed grade requests, and network timeouts.
2. Compare mobile median/p95 request latency for /classes, /grades/:classId/students/:studentId, /grades/:classId/gradebook, and /attendance/sessions?classId=... .
3. Verify student grade visibility: unreleased final grades must remain hidden.
4. Verify teacher class ownership, student enrollment, grade locks, and attendance record permissions.
5. Validate slow 3G/4G and Wi-Fi on mobile Safari and Chrome.
6. Do not execute production schema changes or deploy without explicit review of results.
