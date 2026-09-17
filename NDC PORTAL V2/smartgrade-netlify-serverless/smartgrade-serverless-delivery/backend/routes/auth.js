const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
const { JWT_SECRET, authenticate } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { isNonEmptyString, isEmail } = require('../utils/validate');

const router = express.Router();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function netlifyClientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  const nfIp = req.headers['x-nf-client-connection-ip'];
  if (typeof nfIp === 'string' && nfIp.trim()) return nfIp.trim();
  return 'netlify-client';
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: netlifyClientKey,
  message: { error: 'Too many login attempts. Please try again later.' },
});

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

// ---------- LOGIN ----------
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!isNonEmptyString(String(email || '')) || !isNonEmptyString(String(password || ''))) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = rows[0];
    const genericFail = () => res.status(401).json({ error: 'Invalid email or password.' });

    if (!user) return genericFail();

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: `Account temporarily locked due to repeated failed logins. Try again after ${user.locked_until}.` });
    }

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      const attempts = user.failed_login_attempts + 1;
      let lockedUntil = null;
      if (attempts >= MAX_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      }
      await pool.query(`UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`, [attempts, lockedUntil, user.id]);
      await audit(req, { action: 'login_failed', recordType: 'user', recordId: user.id });
      return genericFail();
    }

    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated. Contact an administrator.' });
    if (user.approval_status === 'pending') return res.status(403).json({ error: 'Your account is pending administrator approval.' });
    if (user.approval_status === 'rejected') return res.status(403).json({ error: 'Your registration was not approved. Contact an administrator.' });

    await pool.query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id]);

    let profile = null;
    if (user.role === 'student') profile = (await pool.query(`SELECT * FROM students WHERE id = $1`, [user.id])).rows[0];
    if (user.role === 'teacher') profile = (await pool.query(`SELECT * FROM teachers WHERE id = $1`, [user.id])).rows[0];

    const token = signToken(user);
    await audit(req, { action: 'login', recordType: 'user', recordId: user.id });
    res.json({ token, user: { id: user.id, role: user.role, email: user.email, profile } });
  } catch (e) { next(e); }
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
