const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticate, requireRole, requireClassOwnership } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { isNonEmptyString } = require('../utils/validate');
const { validateWeights } = require('../utils/grading');

const router = express.Router();
router.use(authenticate);

function genClassCode(subject) {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const prefix = subject.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'CLASS';
  return `${prefix}-${year}-${suffix}`;
}

async function getOrCreateCurrentTerm() {
  const { rows } = await pool.query(`SELECT * FROM academic_terms WHERE is_current = TRUE`);
  if (rows[0]) return rows[0];
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO academic_terms (id, academic_year, semester, is_current) VALUES ($1, $2, $3, TRUE)`,
    [id, `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, '1st Semester']
  );
  return (await pool.query(`SELECT * FROM academic_terms WHERE id = $1`, [id])).rows[0];
}

// ---------- CREATE CLASS ----------
router.post('/', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const { subject, section, yearLevel, roomNumber, termId } = req.body;
    if (![subject, section, yearLevel].every(v => isNonEmptyString(String(v || '')))) {
      return res.status(400).json({ error: 'Subject, section, and year level are required.' });
    }
    const teacherId = req.user.role === 'teacher' ? req.user.id : req.body.teacherId;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required for admin-created classes.' });

    const term = termId ? (await pool.query(`SELECT * FROM academic_terms WHERE id = $1`, [termId])).rows[0] : await getOrCreateCurrentTerm();
    if (!term) return res.status(400).json({ error: 'Invalid academic term.' });

    let classCode, exists = true;
    while (exists) {
      classCode = genClassCode(subject);
      exists = (await pool.query(`SELECT id FROM classes WHERE class_code = $1`, [classCode])).rows[0];
    }

    const id = crypto.randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO classes (id, teacher_id, subject, section, year_level, room_number, term_id, class_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, teacherId, subject, section, yearLevel, roomNumber || null, term.id, classCode]
      );
      await client.query(`INSERT INTO grading_weights (class_id) VALUES ($1)`, [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await audit(req, { action: 'class_creation', recordType: 'class', recordId: id, newValue: { subject, section, classCode } });
    res.status(201).json((await pool.query(`SELECT * FROM classes WHERE id = $1`, [id])).rows[0]);
  } catch (e) { next(e); }
});

// ---------- LIST CLASSES (scoped by role) ----------
router.get('/', async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.json((await pool.query(`SELECT * FROM classes ORDER BY created_at DESC`)).rows);
    }
    if (req.user.role === 'teacher') {
      return res.json((await pool.query(`SELECT * FROM classes WHERE teacher_id = $1 ORDER BY created_at DESC`, [req.user.id])).rows);
    }
    const { rows } = await pool.query(`
      SELECT c.*, e.status AS enrollment_status FROM classes c
      JOIN enrollments e ON e.class_id = c.id
      WHERE e.student_id = $1 AND e.status IN ('active', 'pending')
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ---------- JOIN CLASS VIA CLASS CODE (student) — creates a PENDING request ----------
router.post('/join', requireRole('student'), async (req, res, next) => {
  try {
    const { classCode } = req.body;
    if (!isNonEmptyString(classCode)) return res.status(400).json({ error: 'Class code is required.' });

    const cls = (await pool.query(`SELECT * FROM classes WHERE class_code = $1 AND is_active = TRUE`, [classCode.trim()])).rows[0];
    if (!cls) return res.status(404).json({ error: 'Invalid class code.' });

    const existing = (await pool.query(`SELECT * FROM enrollments WHERE student_id = $1 AND class_id = $2`, [req.user.id, cls.id])).rows[0];
    if (existing && existing.status === 'pending') return res.status(409).json({ error: 'Your request to join this class is already pending teacher approval.' });
    if (existing && existing.status === 'active') return res.status(409).json({ error: 'You are already enrolled in this class.' });

    if (existing) {
      await pool.query(`UPDATE enrollments SET status = 'pending', enrolled_at = now() WHERE id = $1`, [existing.id]);
      await audit(req, { action: 'class_enrollment', recordType: 'enrollment', recordId: existing.id, previousValue: existing.status, newValue: 'pending' });
      return res.status(201).json({ message: 'Request sent. Your teacher must approve you before you appear in the class.', class: cls });
    }

    const id = crypto.randomUUID();
    await pool.query(`INSERT INTO enrollments (id, student_id, class_id, status) VALUES ($1, $2, $3, 'pending')`, [id, req.user.id, cls.id]);

    await audit(req, { action: 'class_enrollment', recordType: 'enrollment', recordId: id, newValue: { classId: cls.id, status: 'pending' } });
    res.status(201).json({ message: 'Request sent. Your teacher must approve you before you appear in the class.', class: cls });
  } catch (e) { next(e); }
});

// ---------- CLASS ROSTER (active students only) ----------
router.get('/:classId/roster', requireClassOwnership, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, e.status AS enrollment_status FROM students s
      JOIN enrollments e ON e.student_id = s.id
      WHERE e.class_id = $1 AND e.status = 'active'
      ORDER BY s.last_name, s.first_name
    `, [req.params.classId]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ---------- PENDING ENROLLMENT REQUESTS ----------
router.get('/:classId/pending-enrollments', requireClassOwnership, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.id AS enrollment_id, s.* FROM students s
      JOIN enrollments e ON e.student_id = s.id
      WHERE e.class_id = $1 AND e.status = 'pending'
      ORDER BY e.enrolled_at ASC
    `, [req.params.classId]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/:classId/enrollments/:studentId/approve', requireClassOwnership, async (req, res, next) => {
  try {
    const enrollment = (await pool.query(`SELECT * FROM enrollments WHERE class_id = $1 AND student_id = $2`, [req.params.classId, req.params.studentId])).rows[0];
    if (!enrollment || enrollment.status !== 'pending') return res.status(404).json({ error: 'No pending request found for this student.' });

    await pool.query(`UPDATE enrollments SET status = 'active' WHERE id = $1`, [enrollment.id]);
    await pool.query(`INSERT INTO grade_status (student_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [req.params.studentId, req.params.classId]);

    await audit(req, { action: 'class_enrollment', recordType: 'enrollment', recordId: enrollment.id, previousValue: 'pending', newValue: 'active' });
    res.json({ message: 'Student approved and added to the class.' });
  } catch (e) { next(e); }
});

router.post('/:classId/enrollments/:studentId/reject', requireClassOwnership, async (req, res, next) => {
  try {
    const enrollment = (await pool.query(`SELECT * FROM enrollments WHERE class_id = $1 AND student_id = $2`, [req.params.classId, req.params.studentId])).rows[0];
    if (!enrollment || enrollment.status !== 'pending') return res.status(404).json({ error: 'No pending request found for this student.' });

    await pool.query(`UPDATE enrollments SET status = 'rejected' WHERE id = $1`, [enrollment.id]);
    await audit(req, { action: 'class_enrollment', recordType: 'enrollment', recordId: enrollment.id, previousValue: 'pending', newValue: 'rejected' });
    res.json({ message: 'Join request rejected.' });
  } catch (e) { next(e); }
});

// ---------- GRADING WEIGHTS ----------
router.get('/:classId/weights', requireClassOwnership, async (req, res, next) => {
  try {
    const w = (await pool.query(`SELECT * FROM grading_weights WHERE class_id = $1`, [req.params.classId])).rows[0];
    res.json(w || { attendance_weight: 10, quiz_weight: 20, performance_weight: 30, exam_weight: 40 });
  } catch (e) { next(e); }
});

router.put('/:classId/weights', requireClassOwnership, async (req, res, next) => {
  try {
    const { attendance_weight, quiz_weight, performance_weight, exam_weight } = req.body;
    const check = validateWeights({ attendance_weight, quiz_weight, performance_weight, exam_weight });
    if (!check.valid) return res.status(400).json({ error: check.message });

    const prev = (await pool.query(`SELECT * FROM grading_weights WHERE class_id = $1`, [req.params.classId])).rows[0];
    await pool.query(`
      INSERT INTO grading_weights (class_id, attendance_weight, quiz_weight, performance_weight, exam_weight)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (class_id) DO UPDATE SET
        attendance_weight = excluded.attendance_weight,
        quiz_weight = excluded.quiz_weight,
        performance_weight = excluded.performance_weight,
        exam_weight = excluded.exam_weight
    `, [req.params.classId, attendance_weight, quiz_weight, performance_weight, exam_weight]);

    await audit(req, {
      action: 'grading_weights_updated', recordType: 'class', recordId: req.params.classId,
      previousValue: prev, newValue: { attendance_weight, quiz_weight, performance_weight, exam_weight },
    });
    res.json({ message: 'Grading weights updated.' });
  } catch (e) { next(e); }
});

module.exports = router;
