const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const {
  authenticate,
  requireRole,
  requireClassOwnership
} = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { computeClassGrade, buildAdjustmentContext, computeAdjustmentDelta } = require('../utils/grading');

const router = express.Router();

router.use(authenticate);


// ============================================================
// HELPERS
// ============================================================

function checkStudentAccess(req, studentId) {
  return req.user.role !== 'student' || req.user.id === studentId;
}


/**
 * Build the gradebook for a class.
 *
 * Returns only ACTIVE students.
 *
 * This helper is used by both:
 *
 * GET /grades/:classId
 * GET /grades/:classId/gradebook
 *
 * Keeping the logic in one place prevents the two endpoints
 * from producing different results.
 */
async function getClassGradebook(classId) {

  const { rows: roster } = await pool.query(`
    SELECT
      s.id,
      s.student_number,
      s.first_name,
      s.last_name
    FROM students s
    JOIN enrollments e
      ON e.student_id = s.id
    WHERE e.class_id = $1
      AND e.status = 'active'
    ORDER BY s.last_name, s.first_name
  `, [classId]);


  const rowsOut = await Promise.all(
    roster.map(async (s) => {

      const grade = await computeClassGrade(
        s.id,
        classId
      );

      return {
        studentId: s.id,
        studentNumber: s.student_number,
        studentName: `${s.last_name}, ${s.first_name}`,

        attendance:
          grade.components.attendance.percent,

        quiz:
          grade.components.quiz.percent,

        performance:
          grade.components.performance.percent,

        exam:
          grade.components.exam.percent,

        finalGrade:
          grade.finalGrade,

        status:
          grade.status,

        incompleteReason:
          grade.message
      };
    })
  );

  return rowsOut;
}


// ============================================================
// STUDENT / TEACHER INDIVIDUAL GRADE
// ============================================================

router.get(
  '/:classId/students/:studentId',
  async (req, res, next) => {

    try {

      const {
        classId,
        studentId
      } = req.params;


      // --------------------------------------------------------
      // STUDENT SELF-ACCESS CHECK
      // --------------------------------------------------------

      if (!checkStudentAccess(req, studentId)) {

        return res.status(403).json({
          error:
            'You are not authorized to perform this action.'
        });

      }


      // --------------------------------------------------------
      // TEACHER CLASS OWNERSHIP CHECK
      // --------------------------------------------------------

      if (req.user.role === 'teacher') {

        const cls = (
          await pool.query(
            `
            SELECT teacher_id
            FROM classes
            WHERE id = $1
            `,
            [classId]
          )
        ).rows[0];


        if (
          !cls ||
          cls.teacher_id !== req.user.id
        ) {

          return res.status(403).json({
            error:
              'You are not authorized to perform this action.'
          });

        }

      }


      // --------------------------------------------------------
      // COMPUTE GRADE
      // --------------------------------------------------------

      const result =
        await computeClassGrade(
          studentId,
          classId
        );


      // --------------------------------------------------------
      // STUDENT VISIBILITY
      // --------------------------------------------------------

      if (
        req.user.role === 'student' &&
        result.status !== 'released'
      ) {

        return res.json({
          ...result,

          finalGrade: null,

          visibleToStudent: false
        });

      }


      res.json({
        ...result,
        visibleToStudent: true
      });

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// GRADEBOOK
// ============================================================

/**
 * PRIMARY GRADEBOOK ENDPOINT
 *
 * GET /grades/:classId
 *
 * This endpoint is required by the enhanced Teacher Dashboard.
 */
router.get(
  '/:classId',
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const gradebook =
        await getClassGradebook(
          req.params.classId
        );

      res.json(gradebook);

    } catch (e) {

      next(e);

    }

  }
);


/**
 * ORIGINAL GRADEBOOK ENDPOINT
 *
 * GET /grades/:classId/gradebook
 *
 * Kept for backward compatibility with the
 * existing Teacher Dashboard.
 */
router.get(
  '/:classId/gradebook',
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const gradebook =
        await getClassGradebook(
          req.params.classId
        );

      res.json(gradebook);

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// FINALIZE GRADE
// ============================================================

router.post(
  '/:classId/students/:studentId/finalize',
  requireRole('teacher', 'admin'),
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const {
        classId,
        studentId
      } = req.params;


      const result =
        await computeClassGrade(
          studentId,
          classId
        );


      if (!result.complete) {

        return res.status(400).json({
          error:
            `Cannot finalize an incomplete grade. ${result.message}`
        });

      }


      const prev = (
        await pool.query(
          `
          SELECT status
          FROM grade_status
          WHERE student_id = $1
            AND class_id = $2
          `,
          [
            studentId,
            classId
          ]
        )
      ).rows[0];


      await pool.query(
        `
        INSERT INTO grade_status
        (
          student_id,
          class_id,
          status,
          finalized_by,
          finalized_at
        )
        VALUES
        (
          $1,
          $2,
          'finalized',
          $3,
          now()
        )

        ON CONFLICT
        (
          student_id,
          class_id
        )

        DO UPDATE SET
          status = 'finalized',
          finalized_by = excluded.finalized_by,
          finalized_at = excluded.finalized_at
        `,
        [
          studentId,
          classId,
          req.user.id
        ]
      );


      await audit(req, {

        action:
          'grade_finalization',

        recordType:
          'grade_status',

        recordId:
          `${studentId}:${classId}`,

        previousValue:
          prev,

        newValue:
          'finalized'

      });


      res.json({
        message:
          'Grade finalized.'
      });

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// RELEASE GRADE
// ============================================================

router.post(
  '/:classId/students/:studentId/release',
  requireRole('teacher', 'admin'),
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const {
        classId,
        studentId
      } = req.params;


      const status = (
        await pool.query(
          `
          SELECT status
          FROM grade_status
          WHERE student_id = $1
            AND class_id = $2
          `,
          [
            studentId,
            classId
          ]
        )
      ).rows[0];


      if (
        !status ||
        status.status !== 'finalized'
      ) {

        return res.status(400).json({
          error:
            'Grade must be finalized before it can be released.'
        });

      }


      await pool.query(
        `
        UPDATE grade_status

        SET
          status = 'released',
          released_at = now()

        WHERE student_id = $1
          AND class_id = $2
        `,
        [
          studentId,
          classId
        ]
      );


      await audit(req, {

        action:
          'grade_release',

        recordType:
          'grade_status',

        recordId:
          `${studentId}:${classId}`

      });


      res.json({
        message:
          'Grade released to student.'
      });

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// REOPEN GRADE
// ============================================================

router.post(
  '/:classId/students/:studentId/reopen',
  requireRole('admin'),
  async (req, res, next) => {

    try {

      const {
        classId,
        studentId
      } = req.params;


      const prev = (
        await pool.query(
          `
          SELECT status
          FROM grade_status
          WHERE student_id = $1
            AND class_id = $2
          `,
          [
            studentId,
            classId
          ]
        )
      ).rows[0];


      await pool.query(
        `
        UPDATE grade_status

        SET
          status = 'in_progress'

        WHERE student_id = $1
          AND class_id = $2
        `,
        [
          studentId,
          classId
        ]
      );


      await audit(req, {

        action:
          'grade_finalization',

        recordType:
          'grade_status',

        recordId:
          `${studentId}:${classId}`,

        previousValue:
          prev,

        newValue:
          'reopened_by_admin'

      });


      res.json({
        message:
          'Grade reopened for editing.'
      });

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// GRADE ADJUSTMENTS (manual teacher override, additive layer)
//
// Exactly one adjustment can exist per (student, class, component).
// Stored as a percentage-point delta (see utils/grading.js for why) but
// the API here works in the friendly "current total / max possible" terms
// the Teacher Dashboard shows, so the frontend never has to do this math.
// ============================================================

const VALID_COMPONENTS = ['attendance', 'quiz', 'performance', 'exam'];

async function assertEnrolled(studentId, classId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM enrollments WHERE student_id = $1 AND class_id = $2 AND status = 'active'`,
    [studentId, classId]
  );
  return !!rows[0];
}

// ---------- GET current adjustment context for ALL components (populates the edit UI) ----------
router.get('/:classId/students/:studentId/adjustments', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { classId, studentId } = req.params;
    if (!(await assertEnrolled(studentId, classId))) {
      return res.status(404).json({ error: 'Student is not actively enrolled in this class.' });
    }

    const { rows: existing } = await pool.query(
      `SELECT * FROM grade_adjustments WHERE student_id = $1 AND class_id = $2`,
      [studentId, classId]
    );
    const byComponent = {};
    for (const r of existing) byComponent[r.component] = r;

    const result = {};
    for (const component of VALID_COMPONENTS) {
      const ctx = await buildAdjustmentContext(studentId, classId, component);
      const existingAdj = byComponent[component];
      result[component] = ctx.error
        ? { available: false, message: ctx.error }
        : {
            available: true,
            recordedTotal: ctx.recordedTotal,
            max: ctx.max,
            label: ctx.label,
            currentAdjustmentPoints: existingAdj ? Number(existingAdj.adjustment_points) : 0,
            // The total the teacher currently sees on screen, recorded + any existing adjustment,
            // expressed back in raw "X / Y" terms rather than percentage points.
            currentTotal: existingAdj
              ? Math.round((ctx.recordedTotal + (Number(existingAdj.adjustment_points) / 100) * ctx.max) * 100) / 100
              : ctx.recordedTotal,
          };
    }
    res.json(result);
  } catch (e) { next(e); }
});

// ---------- SET/UPDATE an adjustment for one component ----------
router.put('/:classId/students/:studentId/adjustments/:component', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { classId, studentId, component } = req.params;
    if (!VALID_COMPONENTS.includes(component)) {
      return res.status(400).json({ error: 'Invalid component.' });
    }
    if (!(await assertEnrolled(studentId, classId))) {
      return res.status(404).json({ error: 'Student is not actively enrolled in this class.' });
    }

    const { newTotal, reason } = req.body;
    const check = await computeAdjustmentDelta(studentId, classId, component, Number(newTotal));
    if (!check.valid) return res.status(400).json({ error: check.message });

    const prev = (await pool.query(
      `SELECT * FROM grade_adjustments WHERE student_id = $1 AND class_id = $2 AND component = $3`,
      [studentId, classId, component]
    )).rows[0];

    await pool.query(`
      INSERT INTO grade_adjustments (id, student_id, class_id, component, adjustment_points, reason, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
      ON CONFLICT (student_id, class_id, component) DO UPDATE SET
        adjustment_points = excluded.adjustment_points,
        reason = excluded.reason,
        created_by = excluded.created_by,
        updated_at = now()
    `, [crypto.randomUUID(), studentId, classId, component, check.deltaPercent, reason || null, req.user.id]);

    await audit(req, {
      action: 'manual_total_adjustment',
      recordType: `grade_adjustment_${component}`,
      recordId: `${studentId}:${classId}`,
      previousValue: prev ? { total: check.recordedTotal + (Number(prev.adjustment_points) / 100) * check.max, max: check.max } : { total: check.recordedTotal, max: check.max },
      newValue: { total: check.newTotal, max: check.max, adjustmentPoints: Math.round((check.newTotal - check.recordedTotal) * 100) / 100, reason: reason || null },
    });

    res.json({ message: `${component[0].toUpperCase() + component.slice(1)} total adjusted to ${check.newTotal} / ${check.max}.` });
  } catch (e) { next(e); }
});

// ---------- REMOVE an adjustment (revert to the original computed total) ----------
router.delete('/:classId/students/:studentId/adjustments/:component', requireRole('teacher', 'admin'), requireClassOwnership, async (req, res, next) => {
  try {
    const { classId, studentId, component } = req.params;
    if (!VALID_COMPONENTS.includes(component)) return res.status(400).json({ error: 'Invalid component.' });

    const prev = (await pool.query(
      `DELETE FROM grade_adjustments WHERE student_id = $1 AND class_id = $2 AND component = $3 RETURNING *`,
      [studentId, classId, component]
    )).rows[0];
    if (!prev) return res.status(404).json({ error: 'No adjustment exists for this component.' });

    await audit(req, {
      action: 'manual_total_adjustment_removed',
      recordType: `grade_adjustment_${component}`,
      recordId: `${studentId}:${classId}`,
      previousValue: { adjustmentPoints: Number(prev.adjustment_points) },
      newValue: null,
    });

    res.json({ message: `${component[0].toUpperCase() + component.slice(1)} adjustment removed — reverted to the original computed total.` });
  } catch (e) { next(e); }
});

module.exports = router;
