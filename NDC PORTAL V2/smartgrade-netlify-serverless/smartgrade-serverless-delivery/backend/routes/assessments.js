const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticate, requireRole, requireClassOwnership } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { isNonEmptyString, validateScore, isFiniteNumber } = require('../utils/validate');

const router = express.Router();
router.use(authenticate);

function assertNotLockedOrAdmin(req, res, isLocked) {
  if (isLocked && req.user.role !== 'admin') {
    res.status(403).json({ error: 'This record is locked. Ask an administrator to unlock it before editing.' });
    return false;
  }
  return true;
}

// ===================== QUIZZES =====================

router.post('/quizzes', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { classId, title, description, quizDate, totalItems, passingScore } = req.body;
    if (!isNonEmptyString(title)) return res.status(400).json({ error: 'Quiz title is required.' });
    if (!isFiniteNumber(totalItems) || totalItems <= 0) return res.status(400).json({ error: 'Total items must be a positive number.' });

    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO quizzes (id, class_id, title, description, quiz_date, total_items, passing_score) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, classId, title, description || null, quizDate || null, totalItems, passingScore ?? null]
    );
    await audit(req, { action: 'score_creation', recordType: 'quiz', recordId: id, newValue: { title, totalItems } });
    res.status(201).json((await pool.query(`SELECT * FROM quizzes WHERE id = $1`, [id])).rows[0]);
  } catch (e) { next(e); }
});

router.get('/quizzes', async (req, res, next) => {
  try {
    const { classId } = req.query;
    if (!classId) return res.status(400).json({ error: 'classId is required.' });
    if (req.user.role === 'student') {
      const enrolled = (await pool.query(`SELECT 1 FROM enrollments WHERE student_id = $1 AND class_id = $2 AND status='active'`, [req.user.id, classId])).rows[0];
      if (!enrolled) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    } else if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [classId])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    res.json((await pool.query(`SELECT * FROM quizzes WHERE class_id = $1 ORDER BY quiz_date DESC`, [classId])).rows);
  } catch (e) { next(e); }
});

router.put('/quizzes/:quizId/scores/:studentId', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const quiz = (await pool.query(`SELECT * FROM quizzes WHERE id = $1`, [req.params.quizId])).rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [quiz.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    const existing = (await pool.query(`SELECT * FROM quiz_scores WHERE quiz_id = $1 AND student_id = $2`, [quiz.id, req.params.studentId])).rows[0];
    if (existing && !assertNotLockedOrAdmin(req, res, existing.is_locked)) return;

    const { rawScore } = req.body;
    const check = validateScore(rawScore, quiz.total_items);
    if (!check.valid) return res.status(400).json({ error: check.message });

    if (existing) {
      await pool.query(`UPDATE quiz_scores SET raw_score = $1, source='teacher', verification_status='verified', updated_at=now() WHERE id = $2`, [rawScore, existing.id]);
      await audit(req, { action: 'score_modification', recordType: 'quiz_score', recordId: existing.id, previousValue: existing.raw_score, newValue: rawScore });
    } else {
      const id = crypto.randomUUID();
      await pool.query(`INSERT INTO quiz_scores (id, quiz_id, student_id, raw_score, source, verification_status) VALUES ($1, $2, $3, $4, 'teacher', 'verified')`, [id, quiz.id, req.params.studentId, rawScore]);
      await audit(req, { action: 'score_creation', recordType: 'quiz_score', recordId: id, newValue: rawScore });
    }
    res.json({ message: 'Quiz score saved.' });
  } catch (e) { next(e); }
});

router.post('/quizzes/:quizId/self-report', requireRole('student'), async (req, res, next) => {
  try {
    const quiz = (await pool.query(`SELECT * FROM quizzes WHERE id = $1`, [req.params.quizId])).rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    const enrolled = (await pool.query(`SELECT 1 FROM enrollments WHERE student_id = $1 AND class_id = $2 AND status='active'`, [req.user.id, quiz.class_id])).rows[0];
    if (!enrolled) return res.status(403).json({ error: 'You are not authorized to perform this action.' });

    const { rawScore } = req.body;
    const check = validateScore(rawScore, quiz.total_items);
    if (!check.valid) return res.status(400).json({ error: check.message });

    const existing = (await pool.query(`SELECT * FROM quiz_scores WHERE quiz_id = $1 AND student_id = $2`, [quiz.id, req.user.id])).rows[0];
    if (existing && existing.verification_status === 'verified') {
      return res.status(403).json({ error: 'This score has already been verified by your teacher and cannot be changed.' });
    }
    if (existing) {
      await pool.query(`UPDATE quiz_scores SET raw_score=$1, source='student_reported', verification_status='pending', updated_at=now() WHERE id=$2`, [rawScore, existing.id]);
    } else {
      const id = crypto.randomUUID();
      await pool.query(`INSERT INTO quiz_scores (id, quiz_id, student_id, raw_score, source, verification_status) VALUES ($1, $2, $3, $4, 'student_reported', 'pending')`, [id, quiz.id, req.user.id, rawScore]);
    }
    await audit(req, { action: 'score_creation', recordType: 'quiz_score', recordId: quiz.id, newValue: { rawScore, source: 'student_reported' } });
    res.status(201).json({ message: 'Score submitted as STUDENT-REPORTED. Awaiting teacher verification.' });
  } catch (e) { next(e); }
});

router.post('/quizzes/:quizId/scores/:studentId/verify', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const quiz = (await pool.query(`SELECT * FROM quizzes WHERE id = $1`, [req.params.quizId])).rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [quiz.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    const { decision } = req.body;
    if (!['verified', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Invalid decision.' });
    const score = (await pool.query(`SELECT * FROM quiz_scores WHERE quiz_id = $1 AND student_id = $2`, [quiz.id, req.params.studentId])).rows[0];
    if (!score) return res.status(404).json({ error: 'Score not found.' });

    await pool.query(`UPDATE quiz_scores SET verification_status = $1 WHERE id = $2`, [decision, score.id]);
    await audit(req, { action: 'score_modification', recordType: 'quiz_score', recordId: score.id, previousValue: score.verification_status, newValue: decision });
    res.json({ message: `Score ${decision}.` });
  } catch (e) { next(e); }
});

router.post('/quizzes/:quizId/lock', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const quiz = (await pool.query(`SELECT * FROM quizzes WHERE id = $1`, [req.params.quizId])).rows[0];
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [quiz.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    await pool.query(`UPDATE quizzes SET is_locked = TRUE WHERE id = $1`, [quiz.id]);
    await pool.query(`UPDATE quiz_scores SET is_locked = TRUE WHERE quiz_id = $1`, [quiz.id]);
    await audit(req, { action: 'grade_finalization', recordType: 'quiz', recordId: quiz.id });
    res.json({ message: 'Quiz scores locked.' });
  } catch (e) { next(e); }
});

// ===================== PERFORMANCE TASKS =====================

router.post('/performance-tasks', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { classId, title, description, taskDate, maxScore, rubric } = req.body;
    if (!isNonEmptyString(title)) return res.status(400).json({ error: 'Task title is required.' });
    if (!isFiniteNumber(maxScore) || maxScore <= 0) return res.status(400).json({ error: 'Maximum score must be a positive number.' });

    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO performance_tasks (id, class_id, title, description, task_date, max_score, rubric) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, classId, title, description || null, taskDate || null, maxScore, rubric || null]
    );
    await audit(req, { action: 'score_creation', recordType: 'performance_task', recordId: id, newValue: { title, maxScore } });
    res.status(201).json((await pool.query(`SELECT * FROM performance_tasks WHERE id = $1`, [id])).rows[0]);
  } catch (e) { next(e); }
});

router.get('/performance-tasks', async (req, res, next) => {
  try {
    const { classId } = req.query;
    if (!classId) return res.status(400).json({ error: 'classId is required.' });
    res.json((await pool.query(`SELECT * FROM performance_tasks WHERE class_id = $1 ORDER BY task_date DESC`, [classId])).rows);
  } catch (e) { next(e); }
});

router.put('/performance-tasks/:taskId/scores/:studentId', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const task = (await pool.query(`SELECT * FROM performance_tasks WHERE id = $1`, [req.params.taskId])).rows[0];
    if (!task) return res.status(404).json({ error: 'Performance task not found.' });
    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [task.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    const existing = (await pool.query(`SELECT * FROM performance_scores WHERE task_id = $1 AND student_id = $2`, [task.id, req.params.studentId])).rows[0];
    if (existing && !assertNotLockedOrAdmin(req, res, existing.is_locked)) return;

    const { rawScore, remarks } = req.body;
    const check = validateScore(rawScore, task.max_score);
    if (!check.valid) return res.status(400).json({ error: check.message });

    if (existing) {
      await pool.query(`UPDATE performance_scores SET raw_score=$1, remarks=$2, updated_at=now() WHERE id=$3`, [rawScore, remarks || null, existing.id]);
      await audit(req, { action: 'score_modification', recordType: 'performance_score', recordId: existing.id, previousValue: existing.raw_score, newValue: rawScore });
    } else {
      const id = crypto.randomUUID();
      await pool.query(`INSERT INTO performance_scores (id, task_id, student_id, raw_score, remarks) VALUES ($1, $2, $3, $4, $5)`, [id, task.id, req.params.studentId, rawScore, remarks || null]);
      await audit(req, { action: 'score_creation', recordType: 'performance_score', recordId: id, newValue: rawScore });
    }
    res.json({ message: 'Performance task score saved.' });
  } catch (e) { next(e); }
});

router.post('/performance-tasks/:taskId/lock', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const task = (await pool.query(`SELECT * FROM performance_tasks WHERE id = $1`, [req.params.taskId])).rows[0];
    if (!task) return res.status(404).json({ error: 'Performance task not found.' });
    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [task.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    await pool.query(`UPDATE performance_tasks SET is_locked = TRUE WHERE id = $1`, [task.id]);
    await pool.query(`UPDATE performance_scores SET is_locked = TRUE WHERE task_id = $1`, [task.id]);
    await audit(req, { action: 'grade_finalization', recordType: 'performance_task', recordId: task.id });
    res.json({ message: 'Performance task scores locked.' });
  } catch (e) { next(e); }
});

// ===================== EXAMINATIONS =====================

router.post('/exams', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { classId, title, examType, examDate, totalItems, maxScore } = req.body;
    if (!isNonEmptyString(title)) return res.status(400).json({ error: 'Exam title is required.' });
    if (!isNonEmptyString(examType)) return res.status(400).json({ error: 'Exam type is required.' });
    if (!isFiniteNumber(maxScore) || maxScore <= 0) return res.status(400).json({ error: 'Maximum score must be a positive number.' });

    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO examinations (id, class_id, title, exam_type, exam_date, total_items, max_score) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, classId, title, examType, examDate || null, totalItems ?? maxScore, maxScore]
    );
    await audit(req, { action: 'score_creation', recordType: 'examination', recordId: id, newValue: { title, examType, maxScore } });
    res.status(201).json((await pool.query(`SELECT * FROM examinations WHERE id = $1`, [id])).rows[0]);
  } catch (e) { next(e); }
});

router.get('/exams', async (req, res, next) => {
  try {
    const { classId } = req.query;
    if (!classId) return res.status(400).json({ error: 'classId is required.' });
    res.json((await pool.query(`SELECT * FROM examinations WHERE class_id = $1 ORDER BY exam_date DESC`, [classId])).rows);
  } catch (e) { next(e); }
});

router.put('/exams/:examId/scores/:studentId', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const exam = (await pool.query(`SELECT * FROM examinations WHERE id = $1`, [req.params.examId])).rows[0];
    if (!exam) return res.status(404).json({ error: 'Examination not found.' });
    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [exam.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    const existing = (await pool.query(`SELECT * FROM exam_scores WHERE exam_id = $1 AND student_id = $2`, [exam.id, req.params.studentId])).rows[0];
    if (existing && !assertNotLockedOrAdmin(req, res, existing.is_locked)) return;

    const { rawScore, remarks } = req.body;
    const check = validateScore(rawScore, exam.max_score);
    if (!check.valid) return res.status(400).json({ error: check.message });

    if (existing) {
      await pool.query(`UPDATE exam_scores SET raw_score=$1, remarks=$2, updated_at=now() WHERE id=$3`, [rawScore, remarks || null, existing.id]);
      await audit(req, { action: 'score_modification', recordType: 'exam_score', recordId: existing.id, previousValue: existing.raw_score, newValue: rawScore });
    } else {
      const id = crypto.randomUUID();
      await pool.query(`INSERT INTO exam_scores (id, exam_id, student_id, raw_score, remarks) VALUES ($1, $2, $3, $4, $5)`, [id, exam.id, req.params.studentId, rawScore, remarks || null]);
      await audit(req, { action: 'score_creation', recordType: 'exam_score', recordId: id, newValue: rawScore });
    }
    res.json({ message: 'Exam score saved.' });
  } catch (e) { next(e); }
});

router.post('/exams/:examId/lock', requireRole('teacher', 'admin'), async (req, res, next) => {
  try {
    const exam = (await pool.query(`SELECT * FROM examinations WHERE id = $1`, [req.params.examId])).rows[0];
    if (!exam) return res.status(404).json({ error: 'Examination not found.' });
    if (req.user.role === 'teacher') {
      const cls = (await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [exam.class_id])).rows[0];
      if (!cls || cls.teacher_id !== req.user.id) return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    await pool.query(`UPDATE examinations SET is_locked = TRUE WHERE id = $1`, [exam.id]);
    await pool.query(`UPDATE exam_scores SET is_locked = TRUE WHERE exam_id = $1`, [exam.id]);
    await audit(req, { action: 'grade_finalization', recordType: 'examination', recordId: exam.id });
    res.json({ message: 'Exam scores locked.' });
  } catch (e) { next(e); }
});

module.exports = router;
