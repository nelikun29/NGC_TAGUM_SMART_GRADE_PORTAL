const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticate, requireRole, requireClassOwnership } = require('../middleware/auth');
const { audit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

const SESSION_MINUTES = 15;
const QR_TOKEN_SECONDS = 60;

function qrSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is required for QR attendance tokens.');
  return secret;
}

function qrToken(sessionId, bucket = Math.floor(Date.now() / (QR_TOKEN_SECONDS * 1000))) {
  const payload = `${sessionId}.${bucket}`;
  const signature = crypto.createHmac('sha256', qrSecret()).update(payload).digest('base64url');
  return `${bucket}.${signature}`;
}

function validQrToken(sessionId, token) {
  const [bucketRaw, signature] = String(token || '').split('.');
  const bucket = Number(bucketRaw);
  if (!Number.isInteger(bucket) || !signature) return false;
  const nowBucket = Math.floor(Date.now() / (QR_TOKEN_SECONDS * 1000));
  if (bucket < nowBucket - 1 || bucket > nowBucket) return false;
  const expected = qrToken(sessionId, bucket).split('.')[1];
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function genAttendanceCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function isSessionUsable(session) {
  if (!session) return false;
  if (session.status === 'closed') return false;
  if (new Date(session.expires_at) <= new Date()) return false;
  return true;
}

async function learnerGradeLocked(classId, studentId) {
  const row = (await pool.query(`SELECT status FROM grade_status WHERE class_id = $1 AND student_id = $2`, [classId, studentId])).rows[0];
  return !!row && ['finalized', 'released'].includes(row.status);
}

async function classHasLockedGrades(classId) {
  return (await pool.query(`SELECT EXISTS(SELECT 1 FROM grade_status WHERE class_id = $1 AND status IN ('finalized','released')) AS locked`, [classId])).rows[0].locked;
}

// ---------- LIST SESSIONS FOR A CLASS ----------
router.get('/sessions', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id) AS recorded_count
      FROM attendance_sessions s WHERE s.class_id = $1 ORDER BY s.session_date DESC, s.opened_at DESC
    `, [req.query.classId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ---------- LIST SESSIONS FOR A CLASS (COMPATIBILITY ROUTE) ----------
// Some frontend code calls GET /attendance/classes/:classId/sessions instead
// of the canonical GET /attendance/sessions?classId=. Support both rather
// than assuming only one shape is ever used.
router.get('/classes/:classId/sessions', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id) AS recorded_count
      FROM attendance_sessions s WHERE s.class_id = $1 ORDER BY s.session_date DESC, s.opened_at DESC
    `, [req.params.classId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ---------- FULL CLASS ROSTER FOR A SESSION, WITH CURRENT STATUS (manual entry) ----------
router.get('/sessions/:sessionId/roster', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const session = (await pool.query(`SELECT * FROM attendance_sessions WHERE id = $1`, [req.params.sessionId])).rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [session.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    const { rows } = await pool.query(`
      SELECT st.id, st.student_number, st.first_name, st.last_name, ar.status, ar.submitted_at
      FROM students st
      JOIN enrollments e ON e.student_id = st.id
      LEFT JOIN attendance_records ar ON ar.session_id = $1 AND ar.student_id = st.id
      WHERE e.class_id = $2 AND e.status = 'active'
      ORDER BY st.last_name, st.first_name
    `, [session.id, session.class_id]);
    res.json({ session, roster: rows });
  } catch (e) { next(e); }
});

// ---------- OPEN ATTENDANCE SESSION ----------
router.post('/sessions', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { classId, sessionDate } = req.body;
    if (!sessionDate) return res.status(400).json({ error: 'sessionDate is required.' });
    if (await classHasLockedGrades(classId)) return res.status(409).json({ error: 'A new attendance session cannot be opened while this class has finalized or released grades. Reopen the affected grades first.' });

    let code, exists = true;
    while (exists) {
      code = genAttendanceCode();
      exists = (await pool.query(`SELECT id FROM attendance_sessions WHERE attendance_code = $1`, [code])).rows[0];
    }

    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60 * 1000).toISOString();
    await pool.query(
      `INSERT INTO attendance_sessions (id, class_id, session_date, attendance_code, status, expires_at) VALUES ($1, $2, $3, $4, 'open', $5)`,
      [id, classId, sessionDate, code, expiresAt]
    );

    await audit(req, { action: 'attendance_session_creation', recordType: 'attendance_session', recordId: id, newValue: { classId, code } });
    res.status(201).json((await pool.query(`SELECT * FROM attendance_sessions WHERE id = $1`, [id])).rows[0]);
  } catch (e) { next(e); }
});

// ---------- CLOSE ATTENDANCE SESSION ----------
router.post('/sessions/:sessionId/close', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const session = (await pool.query(`SELECT * FROM attendance_sessions WHERE id = $1`, [req.params.sessionId])).rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [session.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }

    await pool.query(`UPDATE attendance_sessions SET status = 'closed', closed_at = now() WHERE id = $1`, [session.id]);
    await audit(req, { action: 'attendance_session_closed', recordType: 'attendance_session', recordId: session.id });
    res.json({ message: 'Attendance session closed.' });
  } catch (e) { next(e); }
});

// ---------- TEACHER GETS SHORT-LIVED QR ATTENDANCE CREDENTIAL ----------
router.get('/sessions/:sessionId/qr', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const session = (await pool.query(`SELECT * FROM attendance_sessions WHERE id = $1`, [req.params.sessionId])).rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [session.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    if (!isSessionUsable(session)) return res.status(410).json({ error: 'Attendance session is closed or expired.' });
    res.json({ sessionId: session.id, token: qrToken(session.id), expiresInSeconds: QR_TOKEN_SECONDS });
  } catch (e) { next(e); }
});

// ---------- STUDENT SUBMITS ATTENDANCE BY QR CREDENTIAL ----------
router.post('/submit-qr', requireRole('student'), async (req, res, next) => {
  try {
    const { sessionId, token } = req.body || {};
    if (!sessionId || !token) return res.status(400).json({ error: 'QR attendance credential is required.' });
    const session = (await pool.query(`SELECT * FROM attendance_sessions WHERE id = $1`, [sessionId])).rows[0];
    if (!session) return res.status(404).json({ error: 'Attendance session not found.' });
    if (!isSessionUsable(session)) {
      if (session.status === 'open') await pool.query(`UPDATE attendance_sessions SET status = 'closed', closed_at = now() WHERE id = $1`, [session.id]);
      return res.status(410).json({ error: 'Attendance session is closed.' });
    }
    if (!validQrToken(session.id, token)) return res.status(410).json({ error: 'This QR code has expired. Scan the current QR code shown by your teacher.' });
    const enrolled = (await pool.query(`SELECT 1 FROM enrollments WHERE student_id = $1 AND class_id = $2 AND status = 'active'`, [req.user.id, session.class_id])).rows[0];
    if (!enrolled) return res.status(403).json({ error: 'You are not enrolled in this class.' });
    if (await learnerGradeLocked(session.class_id, req.user.id)) return res.status(409).json({ error: 'Your grade for this class is finalized or released, so attendance can no longer be changed unless an administrator reopens the grade.' });
    const dup = (await pool.query(`SELECT 1 FROM attendance_records WHERE session_id = $1 AND student_id = $2`, [session.id, req.user.id])).rows[0];
    if (dup) return res.status(409).json({ error: 'Attendance has already been recorded for this session.' });
    const id = crypto.randomUUID();
    await pool.query(`INSERT INTO attendance_records (id, session_id, student_id, status, recorded_by) VALUES ($1, $2, $3, 'present', $4)`, [id, session.id, req.user.id, req.user.id]);
    await audit(req, { action: 'attendance_submission_qr', recordType: 'attendance_record', recordId: id, newValue: { sessionId: session.id, status: 'present', method: 'qr' } });
    res.status(201).json({ message: 'Attendance recorded by QR.' });
  } catch (e) { next(e); }
});

// ---------- STUDENT SUBMITS ATTENDANCE CODE ----------
router.post('/submit', requireRole('student'), async (req, res, next) => {
  try {
    const { attendanceCode } = req.body;
    const session = (await pool.query(`SELECT * FROM attendance_sessions WHERE attendance_code = $1`, [(attendanceCode || '').trim().toUpperCase()])).rows[0];

    if (!session) return res.status(404).json({ error: 'Invalid or expired Attendance Code.' });
    if (!isSessionUsable(session)) {
      if (session.status === 'open') await pool.query(`UPDATE attendance_sessions SET status = 'closed', closed_at = now() WHERE id = $1`, [session.id]);
      return res.status(410).json({ error: 'Attendance session is closed.' });
    }

    const enrolled = (await pool.query(`SELECT 1 FROM enrollments WHERE student_id = $1 AND class_id = $2 AND status = 'active'`, [req.user.id, session.class_id])).rows[0];
    if (!enrolled) return res.status(403).json({ error: 'You are not enrolled in this class.' });
    if (await learnerGradeLocked(session.class_id, req.user.id)) return res.status(409).json({ error: 'Your grade for this class is finalized or released, so attendance can no longer be changed unless an administrator reopens the grade.' });

    const dup = (await pool.query(`SELECT 1 FROM attendance_records WHERE session_id = $1 AND student_id = $2`, [session.id, req.user.id])).rows[0];
    if (dup) return res.status(409).json({ error: 'Attendance has already been recorded for this session.' });

    const id = crypto.randomUUID();
    await pool.query(`INSERT INTO attendance_records (id, session_id, student_id, status, recorded_by) VALUES ($1, $2, $3, 'present', $4)`, [id, session.id, req.user.id, req.user.id]);

    await audit(req, { action: 'attendance_submission', recordType: 'attendance_record', recordId: id, newValue: { sessionId: session.id, status: 'present' } });
    res.status(201).json({ message: 'Attendance recorded.' });
  } catch (e) { next(e); }
});

// ---------- TEACHER MANUALLY SETS/OVERRIDES A STUDENT'S STATUS ----------
router.put('/sessions/:sessionId/records/:studentId', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['present', 'late', 'absent', 'excused'].includes(status)) {
      return res.status(400).json({ error: 'Invalid attendance status.' });
    }
    const session = (await pool.query(`SELECT * FROM attendance_sessions WHERE id = $1`, [req.params.sessionId])).rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [session.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    const enrolled = (await pool.query(`SELECT 1 FROM enrollments WHERE student_id = $1 AND class_id = $2 AND status = 'active'`, [req.params.studentId, session.class_id])).rows[0];
    if (!enrolled) return res.status(400).json({ error: 'Student is not actively enrolled in this class.' });
    if (await learnerGradeLocked(session.class_id, req.params.studentId)) return res.status(409).json({ error: 'This learner grade is finalized or released. An administrator must reopen the grade before attendance can be changed.' });

    const existing = (await pool.query(`SELECT * FROM attendance_records WHERE session_id = $1 AND student_id = $2`, [session.id, req.params.studentId])).rows[0];
    if (existing) {
      await pool.query(`UPDATE attendance_records SET status = $1, recorded_by = $2 WHERE id = $3`, [status, req.user.id, existing.id]);
      await audit(req, { action: 'score_modification', recordType: 'attendance_record', recordId: existing.id, previousValue: existing.status, newValue: status });
    } else {
      const id = crypto.randomUUID();
      await pool.query(`INSERT INTO attendance_records (id, session_id, student_id, status, recorded_by) VALUES ($1, $2, $3, $4, $5)`, [id, session.id, req.params.studentId, status, req.user.id]);
      await audit(req, { action: 'score_creation', recordType: 'attendance_record', recordId: id, newValue: { status } });
    }
    res.json({ message: 'Attendance updated.' });
  } catch (e) { next(e); }
});

// ---------- VIEW SESSION + SUBMITTED RECORDS ----------
router.get('/sessions/:sessionId', async (req, res, next) => {
  try {
    const session = (await pool.query(`SELECT * FROM attendance_sessions WHERE id = $1`, [req.params.sessionId])).rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [session.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    if (req.user.role === 'student') {
      const enrolled = (await pool.query(`SELECT 1 FROM enrollments WHERE student_id = $1 AND class_id = $2 AND status = 'active'`, [req.user.id, session.class_id])).rows[0];
      if (!enrolled) return res.status(403).json({ error: 'You are not authorized to access this attendance session.' });
      const rows = (await pool.query(`SELECT ar.*, s.first_name, s.last_name, s.student_number FROM attendance_records ar JOIN students s ON s.id = ar.student_id WHERE ar.session_id = $1 AND ar.student_id = $2`, [session.id, req.user.id])).rows;
      return res.json({ session, records: rows });
    }
    const { rows } = await pool.query(`
      SELECT ar.*, s.first_name, s.last_name, s.student_number FROM attendance_records ar
      JOIN students s ON s.id = ar.student_id WHERE ar.session_id = $1
    `, [session.id]);
    res.json({ session, records: rows });
  } catch (e) { next(e); }
});

// ---------- STUDENT'S OWN ATTENDANCE HISTORY ----------
router.get('/history/:studentId', async (req, res, next) => {
  try {
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
      return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    const { rows } = await pool.query(`
      SELECT ar.status, ar.submitted_at, s.session_date, c.subject, c.section
      FROM attendance_records ar
      JOIN attendance_sessions s ON s.id = ar.session_id
      JOIN classes c ON c.id = s.class_id
      WHERE ar.student_id = $1
      ORDER BY s.session_date DESC
    `, [req.params.studentId]);
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
