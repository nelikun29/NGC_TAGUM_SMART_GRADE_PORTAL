const { pool } = require('../db');
const { authenticate } = require('./auth');

async function classAccess(req, res, classId) {
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'teacher') {
    const row = (await pool.query('SELECT teacher_id FROM classes WHERE id=$1', [classId])).rows[0];
    if (!row || row.teacher_id !== req.user.id) {
      res.status(403).json({ error: 'You are not authorized to access this class.' });
      return false;
    }
    return true;
  }
  if (req.user.role === 'student') {
    const row = (await pool.query("SELECT 1 FROM enrollments WHERE student_id=$1 AND class_id=$2 AND status='active'", [req.user.id, classId])).rows[0];
    if (!row) {
      res.status(403).json({ error: 'You are not authorized to access this class.' });
      return false;
    }
    return true;
  }
  res.status(403).json({ error: 'You are not authorized to access this class.' });
  return false;
}

async function resolveAssessment(path) {
  let match = path.match(/^\/quizzes\/([^/]+)/);
  if (match) return (await pool.query('SELECT id,class_id,is_locked FROM quizzes WHERE id=$1', [match[1]])).rows[0];
  match = path.match(/^\/performance-tasks\/([^/]+)/);
  if (match) return (await pool.query('SELECT id,class_id,is_locked FROM performance_tasks WHERE id=$1', [match[1]])).rows[0];
  match = path.match(/^\/exams\/([^/]+)/);
  if (match) return (await pool.query('SELECT id,class_id,is_locked FROM examinations WHERE id=$1', [match[1]])).rows[0];
  return null;
}

async function gradeLocked(classId, studentId) {
  if (studentId) {
    const row = (await pool.query("SELECT status FROM grade_status WHERE class_id=$1 AND student_id=$2", [classId, studentId])).rows[0];
    return row && ['finalized', 'released'].includes(row.status);
  }
  return (await pool.query("SELECT EXISTS(SELECT 1 FROM grade_status WHERE class_id=$1 AND status IN ('finalized','released')) locked", [classId])).rows[0].locked;
}

async function guard(req, res, next) {
  try {
    // Read-list endpoints must not expose another teacher's class or an unenrolled class.
    if (req.method === 'GET' && ['/quizzes', '/performance-tasks', '/exams'].includes(req.path)) {
      if (!req.query.classId) return next(); // existing route returns the canonical 400
      if (!await classAccess(req, res, req.query.classId)) return;
      return next();
    }

    // Assessment creation changes the grade inputs for the whole class.
    if (req.method === 'POST' && ['/quizzes', '/performance-tasks', '/exams'].includes(req.path)) {
      const classId = req.body && req.body.classId;
      if (!classId) return next();
      if (!await classAccess(req, res, classId)) return;
      if (await gradeLocked(classId)) return res.status(409).json({ error: 'Assessments cannot be added because this class has finalized or released grades. Reopen the affected grades first.' });
      return next();
    }

    const item = await resolveAssessment(req.path);
    if (!item) return next();
    if (!await classAccess(req, res, item.class_id)) return;

    // Student self-report remains allowed only for the signed-in student, but never after release/finalization.
    const selfReport = req.method === 'POST' && /\/self-report$/.test(req.path);
    const scoreMatch = req.path.match(/\/scores\/([^/]+)(?:\/verify)?$/);
    const studentId = selfReport ? req.user.id : (scoreMatch ? scoreMatch[1] : null);
    const changesScore = selfReport || (req.method === 'PUT' && !!scoreMatch) || (req.method === 'POST' && /\/verify$/.test(req.path));
    if (changesScore && await gradeLocked(item.class_id, studentId)) {
      return res.status(409).json({ error: 'This learner grade is finalized or released and its assessment scores cannot be changed. An administrator must reopen the grade first.' });
    }
    return next();
  } catch (e) { next(e); }
}

module.exports = [authenticate, guard];
