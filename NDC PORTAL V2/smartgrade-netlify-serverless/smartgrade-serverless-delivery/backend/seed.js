require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool, ensureSchema } = require('./db');

async function upsertUser(role, email, password, approval = 'approved') {
  const existing = (await pool.query(`SELECT id FROM users WHERE email = $1`, [email])).rows[0];
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 12);
  await pool.query(`INSERT INTO users (id, role, email, password_hash, approval_status) VALUES ($1, $2, $3, $4, $5)`, [id, role, email, hash, approval]);
  return id;
}

async function main() {
  await ensureSchema();

  const adminId = await upsertUser('admin', 'admin@portal.edu', 'Admin!2345');

  const teacherId = await upsertUser('teacher', 'prof.delacruz@portal.edu', 'Teacher!2345');
  if (!(await pool.query(`SELECT id FROM teachers WHERE id = $1`, [teacherId])).rows[0]) {
    await pool.query(`INSERT INTO teachers (id, first_name, last_name, department) VALUES ($1, 'Maria', 'Dela Cruz', 'Education')`, [teacherId]);
  }

  const studentId = await upsertUser('student', 'juan.reyes@portal.edu', 'Student!2345');
  if (!(await pool.query(`SELECT id FROM students WHERE id = $1`, [studentId])).rows[0]) {
    await pool.query(
      `INSERT INTO students (id, student_number, first_name, middle_name, last_name, year_level, room_number)
       VALUES ($1, '2026-00125', 'Juan', 'Reyes', 'Dela Cruz', '2nd Year', 'Room 204')`,
      [studentId]
    );
  }

  let term = (await pool.query(`SELECT * FROM academic_terms WHERE is_current = TRUE`)).rows[0];
  if (!term) {
    const termId = crypto.randomUUID();
    await pool.query(`INSERT INTO academic_terms (id, academic_year, semester, is_current) VALUES ($1, '2026-2027', '1st Semester', TRUE)`, [termId]);
    term = { id: termId };
  }

  let cls = (await pool.query(`SELECT * FROM classes WHERE teacher_id = $1`, [teacherId])).rows[0];
  if (!cls) {
    const classId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO classes (id, teacher_id, subject, section, year_level, room_number, term_id, class_code)
       VALUES ($1, $2, 'Educ 15', 'A', '2nd Year', 'Room 204', $3, 'EDUC15-2026-A7X9')`,
      [classId, teacherId, term.id]
    );
    await pool.query(`INSERT INTO grading_weights (class_id) VALUES ($1)`, [classId]);
    cls = { id: classId };

    // Seeded demo student is pre-approved so the demo works immediately;
    // any student who joins for real via a class code starts 'pending'
    // and needs teacher approval (see routes/classes.js).
    await pool.query(`INSERT INTO enrollments (id, student_id, class_id, status) VALUES ($1, $2, $3, 'active') ON CONFLICT DO NOTHING`, [crypto.randomUUID(), studentId, classId]);
    await pool.query(`INSERT INTO grade_status (student_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [studentId, classId]);
  }

  console.log('Seed complete.');
  console.log('Admin login:   admin@portal.edu / Admin!2345');
  console.log('Teacher login: prof.delacruz@portal.edu / Teacher!2345');
  console.log('Student login: juan.reyes@portal.edu / Student!2345');
  console.log('Demo class code: EDUC15-2026-A7X9');
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
