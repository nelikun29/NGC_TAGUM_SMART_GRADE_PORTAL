const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.role, u.email, u.is_active, u.approval_status, u.created_at,
             s.first_name AS s_first, s.last_name AS s_last, s.student_number,
             t.first_name AS t_first, t.last_name AS t_last
      FROM users u
      LEFT JOIN students s ON s.id = u.id
      LEFT JOIN teachers t ON t.id = u.id
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/users/pending', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.role, u.email, u.created_at, t.first_name, t.last_name, t.department
      FROM users u LEFT JOIN teachers t ON t.id = u.id
      WHERE u.approval_status = 'pending' ORDER BY u.created_at ASC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/users/:userId/approve', async (req, res, next) => {
  try {
    const user = (await pool.query(`SELECT * FROM users WHERE id = $1`, [req.params.userId])).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await pool.query(`UPDATE users SET approval_status='approved', updated_at=now() WHERE id=$1`, [user.id]);
    await audit(req, { action: 'account_approval', recordType: 'user', recordId: user.id, previousValue: user.approval_status, newValue: 'approved' });
    res.json({ message: 'Account approved.' });
  } catch (e) { next(e); }
});

router.post('/users/:userId/reject', async (req, res, next) => {
  try {
    const user = (await pool.query(`SELECT * FROM users WHERE id = $1`, [req.params.userId])).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await pool.query(`UPDATE users SET approval_status='rejected', updated_at=now() WHERE id=$1`, [user.id]);
    await audit(req, { action: 'account_approval', recordType: 'user', recordId: user.id, previousValue: user.approval_status, newValue: 'rejected' });
    res.json({ message: 'Account rejected.' });
  } catch (e) { next(e); }
});

router.post('/users/:userId/deactivate', async (req, res, next) => {
  try {
    const user = (await pool.query(`SELECT * FROM users WHERE id = $1`, [req.params.userId])).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await pool.query(`UPDATE users SET is_active=FALSE, updated_at=now() WHERE id=$1`, [user.id]);
    await audit(req, { action: 'account_deactivation', recordType: 'user', recordId: user.id });
    res.json({ message: 'Account deactivated.' });
  } catch (e) { next(e); }
});

router.post('/users/:userId/reactivate', async (req, res, next) => {
  try {
    await pool.query(`UPDATE users SET is_active=TRUE, updated_at=now() WHERE id=$1`, [req.params.userId]);
    await audit(req, { action: 'account_deactivation', recordType: 'user', recordId: req.params.userId, newValue: 'reactivated' });
    res.json({ message: 'Account reactivated.' });
  } catch (e) { next(e); }
});

router.post('/users/:userId/reset-password', async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const hash = bcrypt.hashSync(newPassword, 12);
    await pool.query(`UPDATE users SET password_hash=$1, failed_login_attempts=0, locked_until=NULL WHERE id=$2`, [hash, req.params.userId]);
    await audit(req, { action: 'score_modification', recordType: 'user_password', recordId: req.params.userId });
    res.json({ message: 'Password reset.' });
  } catch (e) { next(e); }
});

router.get('/classes', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, t.first_name AS teacher_first, t.last_name AS teacher_last
      FROM classes c JOIN teachers t ON t.id = c.teacher_id ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/audit-log', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const { rows } = await pool.query(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1`, [limit]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const q = async (sql) => (await pool.query(sql)).rows[0].c;
    const [totalStudents, totalTeachers, totalClasses, activeUsers, pendingRegistrations, attendanceSessions, finalizedGrades] = await Promise.all([
      q(`SELECT COUNT(*)::int c FROM students`),
      q(`SELECT COUNT(*)::int c FROM users WHERE role='teacher' AND approval_status='approved'`),
      q(`SELECT COUNT(*)::int c FROM classes WHERE is_active=TRUE`),
      q(`SELECT COUNT(*)::int c FROM users WHERE is_active=TRUE`),
      q(`SELECT COUNT(*)::int c FROM users WHERE approval_status='pending'`),
      q(`SELECT COUNT(*)::int c FROM attendance_sessions`),
      q(`SELECT COUNT(*)::int c FROM grade_status WHERE status IN ('finalized','released')`),
    ]);
    res.json({ totalStudents, totalTeachers, totalClasses, activeUsers, pendingRegistrations, attendanceSessions, finalizedGrades });
  } catch (e) { next(e); }
});

router.get('/terms', async (req, res, next) => {
  try {
    res.json((await pool.query(`SELECT * FROM academic_terms ORDER BY academic_year DESC`)).rows);
  } catch (e) { next(e); }
});

router.post('/terms', async (req, res, next) => {
  try {
    const { academicYear, semester, setCurrent } = req.body;
    const id = crypto.randomUUID();
    if (setCurrent) await pool.query(`UPDATE academic_terms SET is_current = FALSE`);
    await pool.query(`INSERT INTO academic_terms (id, academic_year, semester, is_current) VALUES ($1, $2, $3, $4)`, [id, academicYear, semester, !!setCurrent]);
    await audit(req, { action: 'class_creation', recordType: 'academic_term', recordId: id, newValue: { academicYear, semester } });
    res.status(201).json({ id, academicYear, semester });
  } catch (e) { next(e); }
});

module.exports = router;
