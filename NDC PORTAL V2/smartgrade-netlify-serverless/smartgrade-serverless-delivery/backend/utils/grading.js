const { pool } = require('../db');

/**
 * SCORE INTEGRITY: this module is the ONLY place final grades are computed.
 * It always re-derives percentages from raw_score/max_score stored
 * server-side. The client never sends a computed percentage or final grade
 * that gets trusted — every grade endpoint calls computeClassGrade() fresh.
 */

async function getWeights(classId) {
  const { rows } = await pool.query(`SELECT * FROM grading_weights WHERE class_id = $1`, [classId]);
  if (!rows[0]) {
    return { attendance_weight: 10, quiz_weight: 20, performance_weight: 30, exam_weight: 40 };
  }
  return rows[0];
}

function validateWeights({ attendance_weight, quiz_weight, performance_weight, exam_weight }) {
  const total = Number(attendance_weight) + Number(quiz_weight) + Number(performance_weight) + Number(exam_weight);
  if (Math.abs(total - 100) > 0.01) {
    return { valid: false, message: 'Assessment weights must total exactly 100%.' };
  }
  if ([attendance_weight, quiz_weight, performance_weight, exam_weight].some(v => Number(v) < 0)) {
    return { valid: false, message: 'Weights cannot be negative.' };
  }
  return { valid: true };
}

async function attendancePercent(studentId, classId) {
  const { rows } = await pool.query(`
    SELECT ar.status FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    WHERE s.class_id = $1 AND ar.student_id = $2
  `, [classId, studentId]);
  if (rows.length === 0) return null;
  const counted = rows.filter(r => r.status !== 'excused');
  if (counted.length === 0) return null;
  const points = counted.reduce((sum, r) => {
    if (r.status === 'present') return sum + 1;
    if (r.status === 'late') return sum + 0.75;
    return sum;
  }, 0);
  return (points / counted.length) * 100;
}

async function componentPercent(studentId, classId, table, parentTable, parentFk, maxField) {
  const { rows } = await pool.query(`
    SELECT sc.raw_score, p.${maxField} AS max_score, sc.verification_status, sc.is_locked
    FROM ${table} sc
    JOIN ${parentTable} p ON sc.${parentFk} = p.id
    WHERE p.class_id = $1 AND sc.student_id = $2
  `, [classId, studentId]);

  if (rows.length === 0) return { percent: null, complete: true, pendingCount: 0 };

  const usable = rows.filter(r => r.verification_status !== 'pending' && r.verification_status !== 'rejected');
  if (usable.length === 0) return { percent: null, complete: rows.length === 0, pendingCount: rows.length };

  const withScores = usable.filter(r => r.raw_score !== null && r.raw_score !== undefined);
  if (withScores.length < usable.length) {
    return { percent: null, complete: false, pendingCount: usable.length - withScores.length };
  }
  if (withScores.length === 0) return { percent: null, complete: false, pendingCount: usable.length };

  const pct = withScores.reduce((sum, r) => sum + (Number(r.raw_score) / Number(r.max_score)) * 100, 0) / withScores.length;
  return { percent: pct, complete: true, pendingCount: 0 };
}

/**
 * Computes a single student's grade for a single class, entirely from
 * server-stored raw data.
 */
async function computeClassGrade(studentId, classId) {
  const weights = await getWeights(classId);

  const [attendancePct, quiz, pt, exam, statusRow] = await Promise.all([
    attendancePercent(studentId, classId),
    componentPercent(studentId, classId, 'quiz_scores', 'quizzes', 'quiz_id', 'total_items'),
    componentPercent(studentId, classId, 'performance_scores', 'performance_tasks', 'task_id', 'max_score'),
    componentPercent(studentId, classId, 'exam_scores', 'examinations', 'exam_id', 'max_score'),
    pool.query(`SELECT status FROM grade_status WHERE student_id = $1 AND class_id = $2`, [studentId, classId]),
  ]);

  const components = {
    attendance: { percent: attendancePct, weight: Number(weights.attendance_weight), available: attendancePct !== null },
    quiz: { percent: quiz.percent, weight: Number(weights.quiz_weight), available: quiz.percent !== null && quiz.complete },
    performance: { percent: pt.percent, weight: Number(weights.performance_weight), available: pt.percent !== null && pt.complete },
    exam: { percent: exam.percent, weight: Number(weights.exam_weight), available: exam.percent !== null && exam.complete },
  };

  const missing = Object.entries(components)
    .filter(([, c]) => c.weight > 0 && !c.available)
    .map(([name]) => name);

  const status = statusRow.rows[0];

  if (missing.length > 0) {
    return {
      complete: false,
      status: status ? status.status : 'in_progress',
      missing,
      components,
      finalGrade: null,
      message: `Grade Incomplete — ${missing.map(m => m[0].toUpperCase() + m.slice(1)).join(', ')} score pending.`,
    };
  }

  let finalGrade = 0;
  for (const c of Object.values(components)) {
    if (c.weight > 0) finalGrade += (c.percent * c.weight) / 100;
  }

  return {
    complete: true,
    status: status ? status.status : 'computed',
    missing: [],
    components,
    finalGrade: Math.round(finalGrade * 100) / 100,
    message: null,
  };
}

module.exports = { getWeights, validateWeights, computeClassGrade };
