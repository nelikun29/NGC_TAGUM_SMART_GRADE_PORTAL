const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const {
  authenticate,
  requireRole,
  requireClassOwnership
} = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { isNonEmptyString } = require('../utils/validate');
const { validateWeights } = require('../utils/grading');

const router = express.Router();

router.use(authenticate);


// ============================================================
// HELPER — GENERATE UNIQUE CLASS CODE
// ============================================================

function genClassCode(subject) {
  const year = new Date().getFullYear();

  const suffix = Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase();

  const prefix =
    subject
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase() || 'CLASS';

  return `${prefix}-${year}-${suffix}`;
}


// ============================================================
// HELPER — GET OR CREATE CURRENT ACADEMIC TERM
// ============================================================

async function getOrCreateCurrentTerm() {

  const { rows } = await pool.query(`
    SELECT *
    FROM academic_terms
    WHERE is_current = TRUE
    ORDER BY academic_year DESC
    LIMIT 1
  `);

  if (rows[0]) {
    return rows[0];
  }

  const id = crypto.randomUUID();

  await pool.query(
    `
      INSERT INTO academic_terms
      (
        id,
        academic_year,
        semester,
        is_current
      )
      VALUES
      (
        $1,
        $2,
        $3,
        TRUE
      )
    `,
    [
      id,
      `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      '1st Semester'
    ]
  );

  return (
    await pool.query(
      `
        SELECT *
        FROM academic_terms
        WHERE id = $1
      `,
      [id]
    )
  ).rows[0];
}


// ============================================================
// CREATE CLASS
// POST /classes
// ============================================================

router.post(
  '/',
  requireRole('teacher', 'admin'),
  async (req, res, next) => {

    try {

      const {
        subject,
        section,
        yearLevel,
        roomNumber,
        termId
      } = req.body;


      // --------------------------------------------------------
      // VALIDATION
      // --------------------------------------------------------

      if (
        !isNonEmptyString(String(subject || '')) ||
        !isNonEmptyString(String(section || '')) ||
        !isNonEmptyString(String(yearLevel || ''))
      ) {

        return res.status(400).json({
          error: 'Subject, section, and year level are required.'
        });

      }


      // --------------------------------------------------------
      // DETERMINE TEACHER
      // --------------------------------------------------------

      const teacherId =
        req.user.role === 'teacher'
          ? req.user.id
          : req.body.teacherId;


      if (!teacherId) {

        return res.status(400).json({
          error: 'teacherId is required for admin-created classes.'
        });

      }


      // --------------------------------------------------------
      // DETERMINE ACADEMIC TERM
      // --------------------------------------------------------

      const term = termId
        ? (
            await pool.query(
              `
                SELECT *
                FROM academic_terms
                WHERE id = $1
              `,
              [termId]
            )
          ).rows[0]
        : await getOrCreateCurrentTerm();


      if (!term) {

        return res.status(400).json({
          error: 'Invalid academic term.'
        });

      }


      // --------------------------------------------------------
      // GENERATE UNIQUE CLASS CODE
      // --------------------------------------------------------

      let classCode;
      let exists = true;

      while (exists) {

        classCode = genClassCode(subject);

        exists = (
          await pool.query(
            `
              SELECT id
              FROM classes
              WHERE class_code = $1
            `,
            [classCode]
          )
        ).rows[0];

      }


      // --------------------------------------------------------
      // CREATE CLASS
      // --------------------------------------------------------

      const id = crypto.randomUUID();

      const client = await pool.connect();

      try {

        await client.query('BEGIN');


        await client.query(
          `
            INSERT INTO classes
            (
              id,
              teacher_id,
              subject,
              section,
              year_level,
              room_number,
              term_id,
              class_code
            )
            VALUES
            (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8
            )
          `,
          [
            id,
            teacherId,
            subject.trim(),
            section.trim(),
            yearLevel.trim(),
            roomNumber
              ? String(roomNumber).trim()
              : null,
            term.id,
            classCode
          ]
        );


        // ------------------------------------------------------
        // CREATE DEFAULT GRADING WEIGHTS
        // ------------------------------------------------------

        await client.query(
          `
            INSERT INTO grading_weights
            (
              class_id
            )
            VALUES
            (
              $1
            )
          `,
          [id]
        );


        await client.query('COMMIT');

      } catch (e) {

        await client.query('ROLLBACK');

        throw e;

      } finally {

        client.release();

      }


      // --------------------------------------------------------
      // AUDIT
      // --------------------------------------------------------

      await audit(req, {
        action: 'class_creation',
        recordType: 'class',
        recordId: id,

        newValue: {
          subject: subject.trim(),
          section: section.trim(),
          yearLevel: yearLevel.trim(),
          roomNumber: roomNumber
            ? String(roomNumber).trim()
            : null,
          classCode
        }
      });


      // --------------------------------------------------------
      // RETURN CREATED CLASS
      // --------------------------------------------------------

      const createdClass = (
        await pool.query(
          `
            SELECT
              c.*,
              at.academic_year,
              at.semester,

              (
                SELECT COUNT(*)::int
                FROM enrollments e
                WHERE
                  e.class_id = c.id
                  AND e.status = 'active'
              ) AS student_count,

              (
                SELECT COUNT(*)::int
                FROM enrollments e
                WHERE
                  e.class_id = c.id
                  AND e.status = 'pending'
              ) AS pending_count

            FROM classes c

            LEFT JOIN academic_terms at
              ON at.id = c.term_id

            WHERE c.id = $1
          `,
          [id]
        )
      ).rows[0];


      res.status(201).json(createdClass);

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// LIST CLASSES
// GET /classes
//
// ADMIN:
//   Returns all classes.
//
// TEACHER:
//   Returns only classes owned by the teacher,
//   including student count, pending count,
//   academic year and semester.
//
// STUDENT:
//   Returns classes where the student is
//   active or pending.
// ============================================================

router.get(
  '/',
  async (req, res, next) => {

    try {

      // ========================================================
      // ADMIN
      // ========================================================

      if (req.user.role === 'admin') {

        const { rows } = await pool.query(`
          SELECT
            c.*,
            at.academic_year,
            at.semester,

            (
              SELECT COUNT(*)::int
              FROM enrollments e
              WHERE
                e.class_id = c.id
                AND e.status = 'active'
            ) AS student_count,

            (
              SELECT COUNT(*)::int
              FROM enrollments e
              WHERE
                e.class_id = c.id
                AND e.status = 'pending'
            ) AS pending_count

          FROM classes c

          LEFT JOIN academic_terms at
            ON at.id = c.term_id

          ORDER BY c.created_at DESC
        `);

        return res.json(rows);

      }


      // ========================================================
      // TEACHER
      // ========================================================

      if (req.user.role === 'teacher') {

        const { rows } = await pool.query(
          `
            SELECT
              c.*,
              at.academic_year,
              at.semester,

              (
                SELECT COUNT(*)::int
                FROM enrollments e
                WHERE
                  e.class_id = c.id
                  AND e.status = 'active'
              ) AS student_count,

              (
                SELECT COUNT(*)::int
                FROM enrollments e
                WHERE
                  e.class_id = c.id
                  AND e.status = 'pending'
              ) AS pending_count

            FROM classes c

            LEFT JOIN academic_terms at
              ON at.id = c.term_id

            WHERE c.teacher_id = $1

            ORDER BY c.created_at DESC
          `,
          [req.user.id]
        );

        return res.json(rows);

      }


      // ========================================================
      // STUDENT
      // ========================================================

      const { rows } = await pool.query(
        `
          SELECT
            c.*,
            at.academic_year,
            at.semester,
            e.status AS enrollment_status

          FROM classes c

          JOIN enrollments e
            ON e.class_id = c.id

          LEFT JOIN academic_terms at
            ON at.id = c.term_id

          WHERE
            e.student_id = $1
            AND e.status IN ('active', 'pending')

          ORDER BY c.created_at DESC
        `,
        [req.user.id]
      );


      res.json(rows);

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// UPDATE CLASS
// PUT /classes/:classId
//
// Teachers can edit ONLY their own classes.
// Admin can edit any class.
//
// Editable:
//   - Subject
//   - Section
//   - Year Level
//   - Room Number
//
// NOT editable here:
//   - Class Code
//   - Teacher
//   - Academic Term
//   - Grading Weights
// ============================================================

router.put(
  '/:classId',
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const {
        subject,
        section,
        yearLevel,
        roomNumber
      } = req.body;


      // --------------------------------------------------------
      // VALIDATION
      // --------------------------------------------------------

      if (
        !isNonEmptyString(String(subject || '')) ||
        !isNonEmptyString(String(section || '')) ||
        !isNonEmptyString(String(yearLevel || ''))
      ) {

        return res.status(400).json({
          error: 'Subject, section, and year level are required.'
        });

      }


      const classId = req.params.classId;


      // --------------------------------------------------------
      // GET EXISTING CLASS
      // --------------------------------------------------------

      const existing = (
        await pool.query(
          `
            SELECT *
            FROM classes
            WHERE id = $1
          `,
          [classId]
        )
      ).rows[0];


      if (!existing) {

        return res.status(404).json({
          error: 'Class not found.'
        });

      }


      // --------------------------------------------------------
      // UPDATE CLASS
      // --------------------------------------------------------

      const updated = (
        await pool.query(
          `
            UPDATE classes

            SET
              subject = $1,
              section = $2,
              year_level = $3,
              room_number = $4

            WHERE id = $5

            RETURNING *
          `,
          [
            subject.trim(),
            section.trim(),
            yearLevel.trim(),
            roomNumber
              ? String(roomNumber).trim()
              : null,
            classId
          ]
        )
      ).rows[0];


      // --------------------------------------------------------
      // AUDIT
      // --------------------------------------------------------

      await audit(req, {

        action: 'class_updated',

        recordType: 'class',

        recordId: classId,

        previousValue: {
          subject: existing.subject,
          section: existing.section,
          year_level: existing.year_level,
          room_number: existing.room_number
        },

        newValue: {
          subject: updated.subject,
          section: updated.section,
          year_level: updated.year_level,
          room_number: updated.room_number
        }

      });


      // --------------------------------------------------------
      // RETURN UPDATED CLASS
      // --------------------------------------------------------

      const fullUpdatedClass = (
        await pool.query(
          `
            SELECT
              c.*,
              at.academic_year,
              at.semester,

              (
                SELECT COUNT(*)::int
                FROM enrollments e
                WHERE
                  e.class_id = c.id
                  AND e.status = 'active'
              ) AS student_count,

              (
                SELECT COUNT(*)::int
                FROM enrollments e
                WHERE
                  e.class_id = c.id
                  AND e.status = 'pending'
              ) AS pending_count

            FROM classes c

            LEFT JOIN academic_terms at
              ON at.id = c.term_id

            WHERE c.id = $1
          `,
          [classId]
        )
      ).rows[0];


      res.json({

        message: 'Class updated successfully.',

        class: fullUpdatedClass

      });

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// JOIN CLASS VIA CLASS CODE
// POST /classes/join
//
// STUDENT ONLY
//
// Creates a PENDING enrollment request.
// Teacher must approve before student becomes active.
// ============================================================

router.post(
  '/join',
  requireRole('student'),
  async (req, res, next) => {

    try {

      const { classCode } = req.body;


      if (!isNonEmptyString(classCode)) {

        return res.status(400).json({
          error: 'Class code is required.'
        });

      }


      // --------------------------------------------------------
      // FIND CLASS
      // --------------------------------------------------------

      const cls = (
        await pool.query(
          `
            SELECT
              c.*,
              at.academic_year,
              at.semester

            FROM classes c

            LEFT JOIN academic_terms at
              ON at.id = c.term_id

            WHERE
              c.class_code = $1
              AND c.is_active = TRUE
          `,
          [classCode.trim()]
        )
      ).rows[0];


      if (!cls) {

        return res.status(404).json({
          error: 'Invalid class code.'
        });

      }


      // --------------------------------------------------------
      // CHECK EXISTING ENROLLMENT
      // --------------------------------------------------------

      const existing = (
        await pool.query(
          `
            SELECT *
            FROM enrollments
            WHERE
              student_id = $1
              AND class_id = $2
          `,
          [
            req.user.id,
            cls.id
          ]
        )
      ).rows[0];


      if (
        existing &&
        existing.status === 'pending'
      ) {

        return res.status(409).json({
          error:
            'Your request to join this class is already pending teacher approval.'
        });

      }


      if (
        existing &&
        existing.status === 'active'
      ) {

        return res.status(409).json({
          error:
            'You are already enrolled in this class.'
        });

      }


      // --------------------------------------------------------
      // REACTIVATE PREVIOUS ENROLLMENT
      // --------------------------------------------------------

      if (existing) {

        await pool.query(
          `
            UPDATE enrollments

            SET
              status = 'pending',
              enrolled_at = now()

            WHERE id = $1
          `,
          [existing.id]
        );


        await audit(req, {

          action: 'class_enrollment',

          recordType: 'enrollment',

          recordId: existing.id,

          previousValue: existing.status,

          newValue: 'pending'

        });


        return res.status(201).json({

          message:
            'Request sent. Your teacher must approve you before you appear in the class.',

          class: cls

        });

      }


      // --------------------------------------------------------
      // CREATE NEW ENROLLMENT
      // --------------------------------------------------------

      const id = crypto.randomUUID();


      await pool.query(
        `
          INSERT INTO enrollments
          (
            id,
            student_id,
            class_id,
            status
          )
          VALUES
          (
            $1,
            $2,
            $3,
            'pending'
          )
        `,
        [
          id,
          req.user.id,
          cls.id
        ]
      );


      // --------------------------------------------------------
      // AUDIT
      // --------------------------------------------------------

      await audit(req, {

        action: 'class_enrollment',

        recordType: 'enrollment',

        recordId: id,

        newValue: {
          classId: cls.id,
          status: 'pending'
        }

      });


      res.status(201).json({

        message:
          'Request sent. Your teacher must approve you before you appear in the class.',

        class: cls

      });

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// CLASS ROSTER
// GET /classes/:classId/roster
//
// ACTIVE STUDENTS ONLY
// ============================================================

router.get(
  '/:classId/roster',
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const { rows } = await pool.query(
        `
          SELECT
            s.*,
            e.status AS enrollment_status

          FROM students s

          JOIN enrollments e
            ON e.student_id = s.id

          WHERE
            e.class_id = $1
            AND e.status = 'active'

          ORDER BY
            s.last_name,
            s.first_name
        `,
        [req.params.classId]
      );


      res.json(rows);

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// PENDING ENROLLMENT REQUESTS
// GET /classes/:classId/pending-enrollments
// ============================================================

router.get(
  '/:classId/pending-enrollments',
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const { rows } = await pool.query(
        `
          SELECT
            e.id AS enrollment_id,
            e.enrolled_at,
            s.*

          FROM students s

          JOIN enrollments e
            ON e.student_id = s.id

          WHERE
            e.class_id = $1
            AND e.status = 'pending'

          ORDER BY
            e.enrolled_at ASC
        `,
        [req.params.classId]
      );


      res.json(rows);

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// APPROVE STUDENT ENROLLMENT
// POST /classes/:classId/enrollments/:studentId/approve
// ============================================================

router.post(
  '/:classId/enrollments/:studentId/approve',
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const enrollment = (
        await pool.query(
          `
            SELECT *
            FROM enrollments

            WHERE
              class_id = $1
              AND student_id = $2
          `,
          [
            req.params.classId,
            req.params.studentId
          ]
        )
      ).rows[0];


      if (
        !enrollment ||
        enrollment.status !== 'pending'
      ) {

        return res.status(404).json({
          error:
            'No pending request found for this student.'
        });

      }


      // --------------------------------------------------------
      // ACTIVATE ENROLLMENT
      // --------------------------------------------------------

      await pool.query(
        `
          UPDATE enrollments

          SET status = 'active'

          WHERE id = $1
        `,
        [enrollment.id]
      );


      // --------------------------------------------------------
      // CREATE GRADE STATUS RECORD
      // --------------------------------------------------------

      await pool.query(
        `
          INSERT INTO grade_status
          (
            student_id,
            class_id
          )

          VALUES
          (
            $1,
            $2
          )

          ON CONFLICT DO NOTHING
        `,
        [
          req.params.studentId,
          req.params.classId
        ]
      );


      // --------------------------------------------------------
      // AUDIT
      // --------------------------------------------------------

      await audit(req, {

        action: 'class_enrollment',

        recordType: 'enrollment',

        recordId: enrollment.id,

        previousValue: 'pending',

        newValue: 'active'

      });


      res.json({

        message:
          'Student approved and added to the class.'

      });

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// REJECT STUDENT ENROLLMENT
// POST /classes/:classId/enrollments/:studentId/reject
// ============================================================

router.post(
  '/:classId/enrollments/:studentId/reject',
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const enrollment = (
        await pool.query(
          `
            SELECT *
            FROM enrollments

            WHERE
              class_id = $1
              AND student_id = $2
          `,
          [
            req.params.classId,
            req.params.studentId
          ]
        )
      ).rows[0];


      if (
        !enrollment ||
        enrollment.status !== 'pending'
      ) {

        return res.status(404).json({
          error:
            'No pending request found for this student.'
        });

      }


      // --------------------------------------------------------
      // REJECT ENROLLMENT
      // --------------------------------------------------------

      await pool.query(
        `
          UPDATE enrollments

          SET status = 'rejected'

          WHERE id = $1
        `,
        [enrollment.id]
      );


      // --------------------------------------------------------
      // AUDIT
      // --------------------------------------------------------

      await audit(req, {

        action: 'class_enrollment',

        recordType: 'enrollment',

        recordId: enrollment.id,

        previousValue: 'pending',

        newValue: 'rejected'

      });


      res.json({

        message:
          'Join request rejected.'

      });

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// GET GRADING WEIGHTS
// GET /classes/:classId/weights
// ============================================================

router.get(
  '/:classId/weights',
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const w = (
        await pool.query(
          `
            SELECT *
            FROM grading_weights
            WHERE class_id = $1
          `,
          [req.params.classId]
        )
      ).rows[0];


      res.json(
        w || {
          attendance_weight: 10,
          quiz_weight: 20,
          performance_weight: 30,
          exam_weight: 40
        }
      );

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// UPDATE GRADING WEIGHTS
// PUT /classes/:classId/weights
// ============================================================

router.put(
  '/:classId/weights',
  requireClassOwnership,
  async (req, res, next) => {

    try {

      const {
        attendance_weight,
        quiz_weight,
        performance_weight,
        exam_weight
      } = req.body;


      // --------------------------------------------------------
      // VALIDATE WEIGHTS
      // --------------------------------------------------------

      const check = validateWeights({
        attendance_weight,
        quiz_weight,
        performance_weight,
        exam_weight
      });


      if (!check.valid) {

        return res.status(400).json({
          error: check.message
        });

      }


      // --------------------------------------------------------
      // GET PREVIOUS VALUES
      // --------------------------------------------------------

      const prev = (
        await pool.query(
          `
            SELECT *
            FROM grading_weights
            WHERE class_id = $1
          `,
          [req.params.classId]
        )
      ).rows[0];


      // --------------------------------------------------------
      // SAVE NEW WEIGHTS
      // --------------------------------------------------------

      await pool.query(
        `
          INSERT INTO grading_weights
          (
            class_id,
            attendance_weight,
            quiz_weight,
            performance_weight,
            exam_weight
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5
          )

          ON CONFLICT (class_id)

          DO UPDATE SET

            attendance_weight =
              EXCLUDED.attendance_weight,

            quiz_weight =
              EXCLUDED.quiz_weight,

            performance_weight =
              EXCLUDED.performance_weight,

            exam_weight =
              EXCLUDED.exam_weight
        `,
        [
          req.params.classId,
          attendance_weight,
          quiz_weight,
          performance_weight,
          exam_weight
        ]
      );


      // --------------------------------------------------------
      // AUDIT
      // --------------------------------------------------------

      await audit(req, {

        action: 'grading_weights_updated',

        recordType: 'class',

        recordId: req.params.classId,

        previousValue: prev,

        newValue: {
          attendance_weight,
          quiz_weight,
          performance_weight,
          exam_weight
        }

      });


      res.json({

        message:
          'Grading weights updated.'

      });

    } catch (e) {

      next(e);

    }

  }
);


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;
