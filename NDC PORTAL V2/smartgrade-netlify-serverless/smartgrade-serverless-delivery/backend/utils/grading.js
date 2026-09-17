const { pool } = require('../db');

/**
 * SCORE INTEGRITY: this module is the ONLY place final grades are computed.
 * It always re-derives percentages from raw_score/max_score stored
 * server-side. The client never sends a computed percentage or final grade
 * that gets trusted — every grade endpoint calls computeClassGrade() fresh.
 *
 * ADJUSTMENT LAYER (added):
 * A teacher can set at most one manual adjustment per (student, class,
 * component). It is stored as a PERCENTAGE-POINT delta on that component's
 * final percent — NOT as a change to any individual attendance/quiz/
 * performance/exam record, which are never modified by an adjustment.
 * This is deliberate: the existing per-component formulas below differ in
 * how they combine multiple records (attendance is points/count, quiz and
 * performance and exam average each item's own percentage). A percentage-
 * point delta is the one representation that plugs into ALL of them
 * identically without changing any of that underlying math — satisfying
 * "do not rewrite the existing grading formula."
 *
 * The teacher-facing UI still shows a friendly "current total / maximum
 * possible" and lets them type a new total — buildAdjustmentContext()
 * below does that raw-points <-> percentage-points translation and
 * validation; the adjustment itself is stored purely in percentage points.
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

async function attendanceRaw(studentId, classId) {
  const { rows } = await pool.query(`
    SELECT ar.status FROM attendance_records ar
    JOIN attendance_sessions s ON ar.session_id = s.id
    WHERE s.class_id = $1 AND ar.student_id = $2
  `, [classId, studentId]);
  const counted = rows.filter(r => r.status !== 'excused');
  if (counted.length === 0) return null;
  const points = counted.reduce((sum, r) => {
    if (r.status === 'present') return sum + 1;
    if (r.status === 'late') return sum + 0.75;
    return sum;
  }, 0);
  return { points, max: counted.length };
}

async function attendancePercent(studentId, classId) {
  const raw = await attendanceRaw(studentId, classId);
  if (!raw) return null;
  return (raw.points / raw.max) * 100;
}

async function componentRaw(studentId, classId, table, parentTable, parentFk, maxField) {
  const { rows } = await pool.query(`
    SELECT sc.raw_score, p.${maxField} AS max_score, sc.verification_status, sc.is_locked
    FROM ${table} sc
    JOIN ${parentTable} p ON sc.${parentFk} = p.id
    WHERE p.class_id = $1 AND sc.student_id = $2
  `, [classId, studentId]);

  const usable = rows.filter(r => r.verification_status !== 'pending' && r.verification_status !== 'rejected');
  const withScores = usable.filter(r => r.raw_score !== null && r.raw_score !== undefined);

  return {
    totalRecords: rows.length,
    usableCount: usable.length,
    scoredCount: withScores.length,
    rawSum: withScores.reduce((sum, r) => sum + Number(r.raw_score), 0),
    maxSum: withScores.reduce((sum, r) => sum + Number(r.max_score), 0),
    items: withScores,
  };
}

async function componentPercent(studentId, classId, table, parentTable, parentFk, maxField) {
  const raw = await componentRaw(studentId, classId, table, parentTable, parentFk, maxField);

  if (raw.totalRecords === 0) return { percent: null, complete: true, pendingCount: 0 };
  if (raw.usableCount === 0) return { percent: null, complete: false, pendingCount: raw.totalRecords };
  if (raw.scoredCount < raw.usableCount) return { percent: null, complete: false, pendingCount: raw.usableCount - raw.scoredCount };
  if (raw.scoredCount === 0) return { percent: null, complete: false, pendingCount: raw.usableCount };

  const pct = raw.items.reduce((sum, r) => sum + (Number(r.raw_score) / Number(r.max_score)) * 100, 0) / raw.items.length;
  return { percent: pct, complete: true, pendingCount: 0 };
}

/** All adjustment rows for a student in a class, keyed by component. */
async function getAdjustments(studentId, classId) {
  const { rows } = await pool.query(
    `SELECT * FROM grade_adjustments WHERE student_id = $1 AND class_id = $2`,
    [studentId, classId]
  );
  const byComponent = {};
  for (const r of rows) byComponent[r.component] = r;
  return byComponent;
}

/**
 * Builds the "current total / X out of Y" context a teacher edits, and
 * validates a proposed new total against it. This is what the adjustment
 * endpoints use — computeClassGrade() itself only needs the stored
 * percentage-point delta, not this friendlier raw-points view.
 */
async function buildAdjustmentContext(studentId, classId, component) {
  if (component === 'attendance') {
    const raw = await attendanceRaw(studentId, classId);
    if (!raw) return { error: 'This student has no recorded attendance sessions yet — nothing to adjust.' };
    return { recordedTotal: raw.points, max: raw.max, label: 'sessions' };
  }

  const map = {
    quiz: ['quiz_scores', 'quizzes', 'quiz_id', 'total_items'],
    performance: ['performance_scores', 'performance_tasks', 'task_id', 'max_score'],
    exam: ['exam_scores', 'examinations', 'exam_id', 'max_score'],
  };
  if (!map[component]) return { error: 'Invalid component.' };

  const raw = await componentRaw(studentId, classId, ...map[component]);
  if (raw.scoredCount === 0) return { error: 'This student has no recorded scores for this component yet — nothing to adjust.' };
  return { recordedTotal: Math.round(raw.rawSum * 100) / 100, max: raw.maxSum, label: 'points' };
}

/**
 * Validates a proposed new total for a component and, if valid, returns the
 * percentage-point delta to store. Never writes anything — callers do that.
 */
async function computeAdjustmentDelta(studentId, classId, component, newTotal) {
  const ctx = await buildAdjustmentContext(studentId, classId, component);
  if (ctx.error) return { valid: false, message: ctx.error };

  if (typeof newTotal !== 'number' || !Number.isFinite(newTotal)) {
    return { valid: false, message: 'New total must be a number.' };
  }
  if (newTotal < 0) {
    return { valid: false, message: `${component[0].toUpperCase() + component.slice(1)} total cannot be negative.` };
  }
  if (newTotal > ctx.max) {
    return { valid: false, message: `${component[0].toUpperCase() + component.slice(1)} total cannot exceed ${ctx.max} ${ctx.label}.` };
  }

  const deltaPercent = ((newTotal - ctx.recordedTotal) / ctx.max) * 100;
  return { valid: true, deltaPercent, recordedTotal: ctx.recordedTotal, max: ctx.max, newTotal };
}

/**
 * Computes a single student's grade for a single class, entirely from
 * server-stored raw data, then layers any manual adjustments on top.
 */
async function computeClassGrade(studentId, classId) {
  const weights = await getWeights(classId);

  const [attendancePct, quiz, pt, exam, statusRow, adjustments] = await Promise.all([
    attendancePercent(studentId, classId),
    componentPercent(studentId, classId, 'quiz_scores', 'quizzes', 'quiz_id', 'total_items'),
    componentPercent(studentId, classId, 'performance_scores', 'performance_tasks', 'task_id', 'max_score'),
    componentPercent(studentId, classId, 'exam_scores', 'examinations', 'exam_id', 'max_score'),
    pool.query(`SELECT status FROM grade_status WHERE student_id = $1 AND class_id = $2`, [studentId, classId]),
    getAdjustments(studentId, classId),
  ]);

  function applyAdjustment(name, percent) {
    const adj = adjustments[name];
    if (!adj || percent === null) return { percent, adjusted: false };
    const adjustedPercent = Math.max(0, Math.min(100, percent + Number(adj.adjustment_points)));
    return { percent: adjustedPercent, adjusted: true, adjustmentPoints: Number(adj.adjustment_points) };
  }

  const attendanceAdj = applyAdjustment('attendance', attendancePct);
  const quizAdj = applyAdjustment('quiz', quiz.percent);
  const ptAdj = applyAdjustment('performance', pt.percent);
  const examAdj = applyAdjustment('exam', exam.percent);

  const components = {
    attendance: { percent: attendanceAdj.percent, weight: Number(weights.attendance_weight), available: attendanceAdj.percent !== null, adjusted: attendanceAdj.adjusted },
    quiz: { percent: quizAdj.percent, weight: Number(weights.quiz_weight), available: quizAdj.percent !== null && quiz.complete, adjusted: quizAdj.adjusted },
    performance: { percent: ptAdj.percent, weight: Number(weights.performance_weight), available: ptAdj.percent !== null && pt.complete, adjusted: ptAdj.adjusted },
    exam: { percent: examAdj.percent, weight: Number(weights.exam_weight), available: examAdj.percent !== null && exam.complete, adjusted: examAdj.adjusted },
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

module.exports = { getWeights, validateWeights, computeClassGrade, buildAdjustmentContext, computeAdjustmentDelta };
