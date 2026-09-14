const express = require('express');
const { pool } = require('../db');
const { authenticate, requireClassOwnership } = require('../middleware/auth');
const { computeClassGrade } = require('../utils/grading');
const { audit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

function toCSV(rows, columns) {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const body = rows.map(r => columns.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  return `${header}\n${body}`;
}

router.get('/:classId/grade-sheet.csv', requireClassOwnership, async (req, res, next) => {
  try {
    const cls = (await pool.query(`SELECT * FROM classes WHERE id = $1`, [req.params.classId])).rows[0];
    const { rows: roster } = await pool.query(`
      SELECT s.* FROM students s JOIN enrollments e ON e.student_id = s.id
      WHERE e.class_id = $1 AND e.status='active' ORDER BY s.last_name, s.first_name
    `, [req.params.classId]);

    const rowsOut = await Promise.all(roster.map(async s => {
      const g = await computeClassGrade(s.id, req.params.classId);
      return {
        studentNumber: s.student_number,
        name: `${s.last_name}, ${s.first_name}`,
        attendance: g.components.attendance.percent?.toFixed(2) ?? '',
        quiz: g.components.quiz.percent?.toFixed(2) ?? '',
        performance: g.components.performance.percent?.toFixed(2) ?? '',
        exam: g.components.exam.percent?.toFixed(2) ?? '',
        finalGrade: g.finalGrade ?? '',
        status: g.status,
      };
    }));

    const csv = toCSV(rowsOut, [
      { key: 'studentNumber', label: 'Student ID' },
      { key: 'name', label: 'Student Name' },
      { key: 'attendance', label: 'Attendance %' },
      { key: 'quiz', label: 'Quiz %' },
      { key: 'performance', label: 'Performance %' },
      { key: 'exam', label: 'Exam %' },
      { key: 'finalGrade', label: 'Final Grade' },
      { key: 'status', label: 'Status' },
    ]);

    await audit(req, { action: 'score_creation', recordType: 'report', recordId: cls.id, newValue: 'grade_sheet_exported' });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="grade-sheet-${cls.class_code}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
});

router.get('/:classId/attendance-report.csv', requireClassOwnership, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.student_number, s.first_name, s.last_name, sess.session_date, ar.status
      FROM attendance_records ar
      JOIN attendance_sessions sess ON sess.id = ar.session_id
      JOIN students s ON s.id = ar.student_id
      WHERE sess.class_id = $1
      ORDER BY sess.session_date, s.last_name
    `, [req.params.classId]);

    const csv = toCSV(rows.map(r => ({
      studentNumber: r.student_number, name: `${r.last_name}, ${r.first_name}`, date: r.session_date, status: r.status,
    })), [
      { key: 'studentNumber', label: 'Student ID' },
      { key: 'name', label: 'Student Name' },
      { key: 'date', label: 'Date' },
      { key: 'status', label: 'Status' },
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
    res.send(csv);
  } catch (e) { next(e); }
});

router.get('/:classId/students/:studentId/report', requireClassOwnership, async (req, res, next) => {
  try {
    const cls = (await pool.query(`SELECT * FROM classes WHERE id = $1`, [req.params.classId])).rows[0];
    const term = (await pool.query(`SELECT * FROM academic_terms WHERE id = $1`, [cls.term_id])).rows[0];
    const student = (await pool.query(`SELECT * FROM students WHERE id = $1`, [req.params.studentId])).rows[0];
    const teacher = (await pool.query(`SELECT * FROM teachers WHERE id = $1`, [cls.teacher_id])).rows[0];
    const grade = await computeClassGrade(req.params.studentId, req.params.classId);

    res.json({
      institution: process.env.INSTITUTION_NAME || 'Smart Grade & Attendance Portal',
      class: { subject: cls.subject, section: cls.section, teacher: `${teacher.first_name} ${teacher.last_name}` },
      term: term ? `${term.academic_year} — ${term.semester}` : null,
      student: { studentNumber: student.student_number, name: `${student.first_name} ${student.last_name}` },
      generatedAt: new Date().toISOString(),
      grade,
    });
  } catch (e) { next(e); }
});

module.exports = router;
