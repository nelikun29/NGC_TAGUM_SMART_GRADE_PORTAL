const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in environment (.env) — refusing to start with an insecure default.');
}

/**
 * Verifies the JWT and loads the current user's role/active/approval status
 * fresh from the DB on every request (not just trusting old token claims),
 * so a deactivated account is rejected immediately, not just at next login.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, role, email, is_active, approval_status FROM users WHERE id = $1`,
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.is_active || user.approval_status !== 'approved') {
      return res.status(401).json({ error: 'Account is not active. Please contact an administrator.' });
    }
    req.user = { id: user.id, role: user.role, email: user.email };
    next();
  } catch (e) {
    next(e);
  }
}

/** Restrict a route to one or more roles. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    next();
  };
}

/**
 * IDOR / ownership guard: confirms the authenticated teacher actually owns
 * the class referenced by :classId (or req.body.classId). Admins bypass.
 */
async function requireClassOwnership(req, res, next) {
  if (req.user.role === 'admin') return next();
  const classId = req.params.classId || req.body.classId || req.query.classId;
  if (!classId) return res.status(400).json({ error: 'classId is required.' });

  try {
    const { rows } = await pool.query(`SELECT teacher_id FROM classes WHERE id = $1`, [classId]);
    const cls = rows[0];
    if (!cls) return res.status(404).json({ error: 'Class not found.' });

    if (req.user.role !== 'teacher' || cls.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to perform this action.' });
    }
    next();
  } catch (e) {
    next(e);
  }
}

function requireSelfStudent(req, res, next) {
  const studentId = req.params.studentId || req.body.studentId;
  if (req.user.role === 'student' && studentId && studentId !== req.user.id) {
    return res.status(403).json({ error: 'You are not authorized to perform this action.' });
  }
  next();
}

module.exports = { authenticate, requireRole, requireClassOwnership, requireSelfStudent, JWT_SECRET };
