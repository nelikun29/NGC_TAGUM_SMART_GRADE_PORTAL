const express = require('express');
const { pool } = require('../db');
const { authenticate, requireRole, requireClassOwnership } = require('../middleware/auth');
const { audit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);
router.use(requireRole('teacher', 'admin'));

// Remove one active student from a class without deleting the student account
// or historical academic records. "dropped" is an existing enrollment status.
router.post('/classes/:classId/students/:studentId/remove', requireClassOwnership, async (req, res, next) => {
  try {
    const { classId, studentId } = req.params;
    const enrollment = (await pool.query(
      `SELECT * FROM enrollments WHERE class_id = $1 AND student_id = $2`,
      [classId, studentId]
    )).rows[0];

    if (!enrollment || enrollment.status !== 'active') {
      return res.status(404).json({ error: 'Active student enrollment not found.' });
    }

    await pool.query(
      `UPDATE enrollments SET status = 'dropped' WHERE id = $1`,
      [enrollment.id]
    );

    await audit(req, {
      action: 'student_removed_from_class',
      recordType: 'enrollment',
      recordId: enrollment.id,
      previousValue: 'active',
      newValue: 'dropped'
    });

    res.json({ message: 'Student removed from class. The student account and historical records were preserved.' });
  } catch (e) { next(e); }
});

// Remove every active student from a class. Pending requests are deliberately untouched.
router.post('/classes/:classId/students/remove-all', requireClassOwnership, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { classId } = req.params;
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE enrollments SET status = 'dropped' WHERE class_id = $1 AND status = 'active' RETURNING id, student_id`,
      [classId]
    );
    await client.query('COMMIT');

    await audit(req, {
      action: 'all_students_removed_from_class',
      recordType: 'class',
      recordId: classId,
      previousValue: { activeStudents: result.rowCount },
      newValue: { activeStudents: 0 }
    });

    res.json({
      message: `${result.rowCount} active student${result.rowCount === 1 ? '' : 's'} removed from class. Student accounts and historical records were preserved.`,
      removedCount: result.rowCount
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally {
    client.release();
  }
});

// Delete an attendance session, whether open or closed, together with only
// the attendance records belonging to that session.
router.delete('/attendance/sessions/:sessionId', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { sessionId } = req.params;
    const session = (await client.query(
      `SELECT s.*, c.teacher_id FROM attendance_sessions s JOIN classes c ON c.id = s.class_id WHERE s.id = $1`,
      [sessionId]
    )).rows[0];

    if (!session) return res.status(404).json({ error: 'Attendance session not found.' });
    if (req.user.role === 'teacher' && session.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to delete this attendance session.' });
    }

    await client.query('BEGIN');
    const records = await client.query(`DELETE FROM attendance_records WHERE session_id = $1`, [sessionId]);
    await client.query(`DELETE FROM attendance_sessions WHERE id = $1`, [sessionId]);
    await client.query('COMMIT');

    await audit(req, {
      action: 'attendance_session_deleted',
      recordType: 'attendance_session',
      recordId: sessionId,
      previousValue: {
        classId: session.class_id,
        sessionDate: session.session_date,
        status: session.status,
        attendanceRecords: records.rowCount
      },
      newValue: null
    });

    res.json({ message: 'Attendance session deleted successfully.' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally {
    client.release();
  }
});

module.exports = router;
