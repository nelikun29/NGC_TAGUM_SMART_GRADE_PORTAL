const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');
const { JWT_SECRET, authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { isNonEmptyString, isEmail } = require('../utils/validate');

const router = express.Router();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
}

// ---------- STUDENT REGISTRATION ----------
router.post('/register/student', async (req, res, next) => {
  try {
    const { studentNumber, firstName, middleName, lastName, yearLevel, roomNumber, email, password } = req.body;

    if (![studentNumber, firstName, lastName, yearLevel, email, password].every(v => isNonEmptyString(String(v || '')))) {
      return res.status(400).json({ error: 'All required fields must be filled in.' });
    }
    if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const dupId = await pool.query(`SELECT id FROM students WHERE student_number = $1`, [studentNumber]);
    if (dupId.rows[0]) return res.status(409).json({ error: 'This Student ID is already registered.' });

    const dupEmail = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (dupEmail.rows[0]) return res.status(409).json({ error: 'This email is already registered.' });

    const id = crypto.randomUUID();
    const hash = bcrypt.hashSync(password, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (id, role, email, password_hash, approval_status) VALUES ($1, 'student', $2, $3, 'approved')`,
        [id, email, hash]
      );
      await client.query(
        `INSERT INTO students (id, student_number, first_name, middle_name, last_name, year_level, room_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, studentNumber, firstName, middleName || null, lastName, yearLevel, roomNumber || null]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await audit(req, { action: 'student_registration', recordType: 'student', recordId: id, newValue: { studentNumber, email } });
    res.status(201).json({ message: 'Registration successful. You may now log in.' });
  } catch (e) { next(e); }
});

// ---------- TEACHER REGISTRATION (requires admin approval) ----------
router.post('/register/teacher', async (req, res, next) => {
  try {
    const { firstName, lastName, department, email, password } = req.body;
    if (![firstName, lastName, email, password].every(v => isNonEmptyString(String(v || '')))) {
      return res.status(400).json({ error: 'All required fields must be filled in.' });
    }
    if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const dupEmail = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (dupEmail.rows[0]) return res.status(409).json({ error: 'This email is already registered.' });

    const id = crypto.randomUUID();
    const hash = bcrypt.hashSync(password, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (id, role, email, password_hash, approval_status) VALUES ($1, 'teacher', $2, $3, 'pending')`,
        [id, email, hash]
      );
      await client.query(
        `INSERT INTO teachers (id, first_name, last_name, department) VALUES ($1, $2, $3, $4)`,
        [id, firstName, lastName, department || null]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await audit(req, { action: 'teacher_registration', recordType: 'teacher', recordId: id, newValue: { email } });
    res.status(201).json({ message: 'Registration submitted. An administrator must approve your account before you can log in.' });
  } catch (e) { next(e); }
});

// ---------- ADMIN-ASSISTED PASSWORD RESET ----------
router.post('/forgot-password', async (req, res, next) => {
  try {
    const normalizedEmail = String((req.body || {}).email || '').trim().toLowerCase();
    const generic = { message: 'If this email is registered, a password-reset request has been submitted for administrator review.' };
    if (!isEmail(normalizedEmail)) return res.json(generic);
    const user = (await pool.query('SELECT id FROM users WHERE lower(email)=$1', [normalizedEmail])).rows[0];
    if (!user) return res.json(generic);
    const existing = (await pool.query("SELECT id FROM password_reset_requests WHERE user_id=$1 AND status='pending'", [user.id])).rows[0];
    if (!existing) {
      await pool.query("INSERT INTO password_reset_requests(id,user_id,status) VALUES($1,$2,'pending')", [crypto.randomUUID(), user.id]);
    }
    res.json(generic);
  } catch (e) { next(e); }
});

router.get('/password-reset-requests', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT pr.id,pr.requested_at,u.id AS user_id,u.email,u.role,
             COALESCE(s.first_name,t.first_name,'') AS first_name,
             COALESCE(s.last_name,t.last_name,'') AS last_name
      FROM password_reset_requests pr
      JOIN users u ON u.id=pr.user_id
      LEFT JOIN students s ON s.id=u.id
      LEFT JOIN teachers t ON t.id=u.id
      WHERE pr.status='pending'
      ORDER BY pr.requested_at ASC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/password-reset-requests/:requestId/complete', authenticate, requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const newPassword = String((req.body || {}).newPassword || '');
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    await client.query('BEGIN');
    const request = (await client.query("SELECT * FROM password_reset_requests WHERE id=$1 AND status='pending' FOR UPDATE", [req.params.requestId])).rows[0];
    if (!request) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pending password reset request not found.' }); }
    const hash = bcrypt.hashSync(newPassword, 12);
    await client.query('UPDATE users SET password_hash=$1,failed_login_attempts=0,locked_until=NULL,updated_at=now() WHERE id=$2', [hash, request.user_id]);
    await client.query("UPDATE password_reset_requests SET status='completed',resolved_at=now(),resolved_by=$1 WHERE id=$2", [req.user.id, request.id]);
    await client.query('COMMIT');
    try { await audit(req,{action:'password_reset_admin',recordType:'user',recordId:request.user_id,newValue:{reset:true,loginLockCleared:true}}); } catch(e) { console.error('[auth/password-reset] audit failed',e); }
    res.json({ message: 'Password reset successfully. The account login lock was also cleared.' });
  } catch(e) { try{await client.query('ROLLBACK');}catch{} next(e); } finally { client.release(); }
});

router.post('/password-reset-requests/:requestId/dismiss', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const row=(await pool.query("UPDATE password_reset_requests SET status='dismissed',resolved_at=now(),resolved_by=$1 WHERE id=$2 AND status='pending' RETURNING user_id",[req.user.id,req.params.requestId])).rows[0];
    if(!row)return res.status(404).json({error:'Pending password reset request not found.'});
    try { await audit(req,{action:'password_reset_dismissed',recordType:'user',recordId:row.user_id}); } catch(e) { console.error('[auth/password-reset] audit failed',e); }
    res.json({message:'Password reset request dismissed.'});
  } catch(e){next(e);}
});

// ---------- LOGIN ----------
// The API already has a Netlify-compatible global request limiter. Login also
// enforces a persistent per-account 5-attempt/15-minute lockout below, so a
// second express-rate-limit middleware here is redundant and can fail before
// the route handler executes in the Netlify serverless request environment.
router.post('/login', async (req, res, next) => {
  let stage = 'validate_request';
  try {
    const { email, password } = req.body || {};
    if (!isNonEmptyString(String(email || '')) || !isNonEmptyString(String(password || ''))) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    stage = 'load_user';
    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows } = await pool.query(`SELECT * FROM users WHERE lower(email) = $1`, [normalizedEmail]);
    const user = rows[0];
    const genericFail = () => res.status(401).json({ error: 'Invalid email or password.' });

    if (!user) return genericFail();

    stage = 'check_lock';
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: `Account temporarily locked due to repeated failed logins. Try again after ${user.locked_until}.` });
    }

    stage = 'verify_password';
    if (typeof user.password_hash !== 'string' || !user.password_hash) {
      console.error('[auth/login] Invalid password hash for user', user.id);
      return res.status(500).json({ error: 'Unable to complete login. Please contact an administrator.' });
    }
    const ok = bcrypt.compareSync(String(password), user.password_hash);
    if (!ok) {
      const attempts = Number(user.failed_login_attempts || 0) + 1;
      let lockedUntil = null;
      if (attempts >= MAX_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      }
      stage = 'record_failed_login';
      await pool.query(`UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`, [attempts, lockedUntil, user.id]);
      await audit(req, { action: 'login_failed', recordType: 'user', recordId: user.id });
      return genericFail();
    }

    stage = 'check_account_status';
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated. Contact an administrator.' });
    if (user.approval_status === 'pending') return res.status(403).json({ error: 'Your account is pending administrator approval.' });
    if (user.approval_status === 'rejected') return res.status(403).json({ error: 'Your registration was not approved. Contact an administrator.' });

    stage = 'reset_login_state';
    await pool.query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id]);

    stage = 'load_profile';
    let profile = null;
    if (user.role === 'student') profile = (await pool.query(`SELECT * FROM students WHERE id = $1`, [user.id])).rows[0] || null;
    if (user.role === 'teacher') profile = (await pool.query(`SELECT * FROM teachers WHERE id = $1`, [user.id])).rows[0] || null;

    stage = 'sign_token';
    const token = signToken(user);
    stage = 'audit_success';
    await audit(req, { action: 'login', recordType: 'user', recordId: user.id });
    res.json({ token, user: { id: user.id, role: user.role, email: user.email, profile } });
  } catch (e) {
    console.error(`[auth/login] stage=${stage}`, e && e.stack ? e.stack : e);
    next(e);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await audit(req, { action: 'logout', recordType: 'user', recordId: req.user.id });
    res.json({ message: 'Logged out.' });
  } catch (e) { next(e); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    let profile = null;
    if (req.user.role === 'student') profile = (await pool.query(`SELECT * FROM students WHERE id = $1`, [req.user.id])).rows[0];
    if (req.user.role === 'teacher') profile = (await pool.query(`SELECT * FROM teachers WHERE id = $1`, [req.user.id])).rows[0];
    res.json({ user: req.user, profile });
  } catch (e) { next(e); }
});

module.exports = router;
