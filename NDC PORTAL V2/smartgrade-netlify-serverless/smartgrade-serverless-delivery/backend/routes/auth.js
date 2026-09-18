const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');
const { JWT_SECRET, authenticate } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { isNonEmptyString, isEmail } = require('../utils/validate');

const router = express.Router();

function requireStudentRole(req,res,next){
  if (!req.user || req.user.role !== 'student') return res.status(403).json({ error:'Student access required.' });
  next();
}

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
      client=await pool.connect();
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
  } catch (e) {
    if (e && e.code === '23505') {
      const constraint=String(e.constraint||'');
      if (constraint.includes('student_number')) return res.status(409).json({ error:'This Student ID is already registered.' });
      return res.status(409).json({ error:'This email is already registered.' });
    }
    next(e);
  }
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
  } catch (e) {
    if (e && e.code === '23505') return res.status(409).json({ error:'This email is already registered.' });
    next(e);
  }
});

// ---------- STUDENT PROFILE UPDATE ----------
router.put('/profile/student', authenticate, requireStudentRole, async (req, res, next) => {
  try {
    const { firstName, middleName, lastName, yearLevel, roomNumber } = req.body || {};
    if (![firstName, lastName, yearLevel].every(v => isNonEmptyString(String(v || '')))) {
      return res.status(400).json({ error: 'First name, last name, and year level are required.' });
    }
    const existing = (await pool.query('SELECT * FROM students WHERE id = $1', [req.user.id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Student profile not found.' });
    const updated = (await pool.query(
      `UPDATE students SET first_name=$1,middle_name=$2,last_name=$3,year_level=$4,room_number=$5 WHERE id=$6 RETURNING *`,
      [String(firstName).trim(), String(middleName || '').trim() || null, String(lastName).trim(), String(yearLevel).trim(), String(roomNumber || '').trim() || null, req.user.id]
    )).rows[0];
    await audit(req, { action:'student_profile_updated', recordType:'student', recordId:req.user.id,
      previousValue:{first_name:existing.first_name,middle_name:existing.middle_name,last_name:existing.last_name,year_level:existing.year_level,room_number:existing.room_number},
      newValue:{first_name:updated.first_name,middle_name:updated.middle_name,last_name:updated.last_name,year_level:updated.year_level,room_number:updated.room_number} });
    res.json({ message:'Profile updated successfully.', profile:updated });
  } catch (e) { next(e); }
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
    let client;
    let user;
    const genericFail = () => res.status(401).json({ error: 'Invalid email or password.' });
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`SELECT * FROM users WHERE lower(email) = $1 FOR UPDATE`, [normalizedEmail]);
      user = rows[0];
      if (!user) { await client.query('ROLLBACK'); return genericFail(); }

      stage = 'check_lock';
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        await client.query('ROLLBACK');
        return res.status(423).json({ error: `Account temporarily locked due to repeated failed logins. Try again after ${user.locked_until}.` });
      }

      stage = 'verify_password';
      if (typeof user.password_hash !== 'string' || !user.password_hash) {
        await client.query('ROLLBACK');
        console.error('[auth/login] Invalid password hash for user', user.id);
        return res.status(500).json({ error: 'Unable to complete login. Please contact an administrator.' });
      }
      const ok = bcrypt.compareSync(String(password), user.password_hash);
      if (!ok) {
        const attempts = Number(user.failed_login_attempts || 0) + 1;
        const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString() : null;
        stage = 'record_failed_login';
        await client.query(`UPDATE users SET failed_login_attempts=$1,locked_until=$2,updated_at=now() WHERE id=$3`,[attempts,lockedUntil,user.id]);
        await client.query('COMMIT');
        await audit(req, { action: 'login_failed', recordType: 'user', recordId: user.id });
        return genericFail();
      }

      stage = 'check_account_status';
      if (!user.is_active) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'This account has been deactivated. Contact an administrator.' }); }
      if (user.approval_status === 'pending') { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Your account is pending administrator approval.' }); }
      if (user.approval_status === 'rejected') { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Your registration was not approved. Contact an administrator.' }); }

      stage = 'reset_login_state';
      await client.query(`UPDATE users SET failed_login_attempts=0,locked_until=NULL,updated_at=now() WHERE id=$1`,[user.id]);
      await client.query('COMMIT');
    } catch(e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally { if(client) client.release(); }

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
    console.error('=== LOGIN FAILURE ===');
    console.error('Stage:', stage);
    console.error('Message:', e && e.message ? e.message : e);
    console.error('Stack:', e && e.stack ? e.stack : e);
    return res.status(500).json({ error: 'Unable to complete login. Please try again.' });
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
