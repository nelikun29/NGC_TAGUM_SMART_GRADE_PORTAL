const express = require('express');
const { pool } = require('../db');
const { authenticate, requireRole, requireClassOwnership } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { computeClassGrade } = require('../utils/grading');

const router = express.Router();
router.use(authenticate);

function checkStudentAccess(req, studentId) {
  return req.user.role !== 'student' || req.user.id === studentId;
}

router.get('/:classId/students/:studentId', async (req, res, next) => {
  try {
    const { classId, studentId } = req.params;
    if (!checkStudentAccess(req, studentId)) return res.status(403).json({ error: 'You are not authorized to perform this action.' });

    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [classId])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }

    const result = await computeClassGrade(studentId, classId);

    if (req.user.role === 'student' && result.status !== 'released') {
      return res.json({ ...result, finalGrade: result.status === 'released' ? result.finalGrade : null, visibleToStudent: false });
    }
    res.json({ ...result, visibleToStudent: true });
  } catch (e) { next(e); }
});

router.get('/:classId/gradebook', requireClassOwnership, async (req, res, next) => {
  try {
    const { rows: roster } = await pool.query(`
      SELECT s.id, s.student_number, s.first_name, s.last_name FROM students s
      JOIN enrollments e ON e.student_id = s.id
      WHERE e.class_id = $1 AND e.status = 'active'
      ORDER BY s.last_name, s.first_name
    `, [req.params.classId]);

    const rowsOut = await Promise.all(roster.map(async s => {
      const grade = await computeClassGrade(s.id, req.params.classId);
      return {
        studentId: s.id,
        studentNumber: s.student_number,
        studentName: `${s.last_name}, ${s.first_name}`,
        attendance: grade.components.attendance.percent,
        quiz: grade.components.quiz.percent,
        performance: grade.components.performance.percent,
        exam: grade.components.exam.percent,
        finalGrade: grade.finalGrade,
        status: grade.status,
        incompleteReason: grade.message,
      };
    }));
    res.json(rowsOut);
  } catch (e) { next(e); }
});

router.post('/:classId/students/:studentId/finalize', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { classId, studentId } = req.params;
    const result = await computeClassGrade(studentId, classId);
    if (!result.complete) {
      return res.status(400).json({ error: `Cannot finalize an incomplete grade. ${result.message}` });
    }
    const prev = (await pool.query(`SELECT status FROM grade_status WHERE student_id = $1 AND class_id = $2`, [studentId, classId])).rows[0];
    await pool.query(`
      INSERT INTO grade_status (student_id, class_id, status, finalized_by, finalized_at)
      VALUES ($1, $2, 'finalized', $3, now())
      ON CONFLICT (student_id, class_id) DO UPDATE SET status='finalized', finalized_by=excluded.finalized_by, finalized_at=excluded.finalized_at
    `, [studentId, classId, req.user.id]);

    await audit(req, { action: 'grade_finalization', recordType: 'grade_status', recordId: `${studentId}:${classId}`, previousValue: prev, newValue: 'finalized' });
    res.json({ message: 'Grade finalized.' });
  } catch (e) { next(e); }
});

router.post('/:classId/students/:studentId/release', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { classId, studentId } = req.params;
    const status = (await pool.query(`SELECT status FROM grade_status WHERE student_id = $1 AND class_id = $2`, [studentId, classId])).rows[0];
    if (!status || status.status !== 'finalized') {
      return res.status(400).json({ error: 'Grade must be finalized before it can be released.' });
    }
    await pool.query(`UPDATE grade_status SET status='released', released_at=now() WHERE student_id=$1 AND class_id=$2`, [studentId, classId]);
    await audit(req, { action: 'grade_release', recordType: 'grade_status', recordId: `${studentId}:${classId}` });
    res.json({ message: 'Grade released to student.' });
  } catch (e) { next(e); }
});

router.post('/:classId/students/:studentId/reopen', requireRole('admin'), async (req, res, next) => {
  try {
    const { classId, studentId } = req.params;
    const prev = (await pool.query(`SELECT status FROM grade_status WHERE student_id = $1 AND class_id = $2`, [studentId, classId])).rows[0];
    await pool.query(`UPDATE grade_status SET status='in_progress' WHERE student_id=$1 AND class_id=$2`, [studentId, classId]);
    await audit(req, { action: 'grade_finalization', recordType: 'grade_status', recordId: `${studentId}:${classId}`, previousValue: prev, newValue: 'reopened_by_admin' });
    res.json({ message: 'Grade reopened for editing.' });
  } catch (e) { next(e); }
});

module.exports = router;
