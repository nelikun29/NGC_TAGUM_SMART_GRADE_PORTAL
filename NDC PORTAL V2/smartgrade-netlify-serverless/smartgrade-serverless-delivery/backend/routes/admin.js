const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.role, u.email, u.is_active, u.approval_status, u.created_at,
             s.first_name AS s_first, s.middle_name AS s_middle, s.last_name AS s_last,
             s.student_number, s.year_level, s.room_number,
             t.first_name AS t_first, t.last_name AS t_last, t.department
      FROM users u
      LEFT JOIN students s ON s.id = u.id
      LEFT JOIN teachers t ON t.id = u.id
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/users/:userId/diagnostics', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = (await pool.query(
      `SELECT id,role,email,is_active,approval_status,failed_login_attempts,locked_until,created_at,updated_at
       FROM users WHERE id=$1`,
      [userId]
    )).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const profileTable = user.role === 'student' ? 'students' : user.role === 'teacher' ? 'teachers' : null;
    let profileExists = true;
    if (profileTable) {
      profileExists = !!(await pool.query(`SELECT id FROM ${profileTable} WHERE id=$1`, [userId])).rows[0];
    }

    let enrollment = null;
    if (user.role === 'student') {
      enrollment = (await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status='active')::int AS active,
           COUNT(*) FILTER (WHERE status='pending')::int AS pending,
           COUNT(*) FILTER (WHERE status='dropped')::int AS dropped,
           COUNT(*) FILTER (WHERE status='rejected')::int AS rejected
         FROM enrollments WHERE student_id=$1`,
        [userId]
      )).rows[0];
    }

    const now = new Date();
    const locked = !!(user.locked_until && new Date(user.locked_until) > now);
    const checks = {
      accountExists: true,
      active: !!user.is_active,
      approved: user.approval_status === 'approved',
      profileLinked: profileExists,
      locked
    };
    const canAuthenticate = checks.active && checks.approved && checks.profileLinked && !checks.locked;

    res.json({
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        isActive: user.is_active,
        approvalStatus: user.approval_status,
        failedLoginAttempts: Number(user.failed_login_attempts || 0),
        lockedUntil: user.locked_until,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      checks,
      enrollment,
      canAuthenticate,
      diagnosis: locked
        ? 'Account is temporarily locked after repeated failed login attempts.'
        : !user.is_active
          ? 'Account is deactivated.'
          : user.approval_status !== 'approved'
            ? `Account approval status is ${user.approval_status}.`
            : !profileExists
              ? `${user.role} profile record is missing or not linked to this user.`
              : 'No account-state blocker was found. If login still fails, inspect the login request/server log and browser session.'
    });
  } catch (e) { next(e); }
});

router.post('/users/:userId/unlock', async (req, res, next) => {
  try {
    const user = (await pool.query(
      'SELECT id,failed_login_attempts,locked_until FROM users WHERE id=$1',
      [req.params.userId]
    )).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await pool.query(
      'UPDATE users SET failed_login_attempts=0,locked_until=NULL,updated_at=now() WHERE id=$1',
      [user.id]
    );
    await audit(req, {
      action: 'account_unlock',
      recordType: 'user',
      recordId: user.id,
      previousValue: { failedLoginAttempts: user.failed_login_attempts, lockedUntil: user.locked_until },
      newValue: { failedLoginAttempts: 0, lockedUntil: null }
    });
    res.json({ message: 'Account login lock cleared.' });
  } catch (e) { next(e); }
});

router.get('/users/pending', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT u.id,u.role,u.email,u.created_at,t.first_name,t.last_name,t.department FROM users u LEFT JOIN teachers t ON t.id=u.id WHERE u.approval_status='pending' ORDER BY u.created_at ASC`);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/users/:userId/correct-role', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { userId } = req.params;
    const targetRole = String(req.body.targetRole || '').trim().toLowerCase();
    if (!['student','teacher'].includes(targetRole)) return res.status(400).json({ error: 'Target role must be Student or Teacher.' });
    if (userId === req.user.id) return res.status(400).json({ error: 'You cannot change your own administrator role.' });
    await client.query('BEGIN');
    const user = (await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found.' }); }
    if (user.role === 'admin') { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Administrator roles cannot be changed here.' }); }
    if (user.role === targetRole) { await client.query('ROLLBACK'); return res.status(409).json({ error: `This account is already a ${targetRole}.` }); }

    if (user.role === 'teacher' && targetRole === 'student') {
      const owned = Number((await client.query('SELECT COUNT(*)::int c FROM classes WHERE teacher_id=$1',[userId])).rows[0].c || 0);
      if (owned > 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Role correction blocked: this teacher account owns ${owned} class${owned===1?'':'es'}. Reassign or resolve those classes before converting the account to Student.` }); }
      const { studentNumber, firstName, middleName, lastName, yearLevel, roomNumber } = req.body;
      if (![studentNumber,firstName,lastName,yearLevel].every(v=>String(v||'').trim())) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Student ID, First Name, Last Name, and Year Level are required.' }); }
      const duplicate = (await client.query('SELECT id FROM students WHERE student_number=$1 AND id<>$2',[String(studentNumber).trim(),userId])).rows[0];
      if (duplicate) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This Student ID is already registered to another account.' }); }
      await client.query('DELETE FROM teachers WHERE id=$1',[userId]);
      await client.query(`INSERT INTO students(id,student_number,first_name,middle_name,last_name,year_level,room_number) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET student_number=EXCLUDED.student_number,first_name=EXCLUDED.first_name,middle_name=EXCLUDED.middle_name,last_name=EXCLUDED.last_name,year_level=EXCLUDED.year_level,room_number=EXCLUDED.room_number`,[userId,String(studentNumber).trim(),String(firstName).trim(),String(middleName||'').trim()||null,String(lastName).trim(),String(yearLevel).trim(),String(roomNumber||'').trim()||null]);
      await client.query(`UPDATE users SET role='student',approval_status='approved',is_active=TRUE,updated_at=now() WHERE id=$1`,[userId]);
    } else if (user.role === 'student' && targetRole === 'teacher') {
      const enrolled = Number((await client.query('SELECT COUNT(*)::int c FROM enrollments WHERE student_id=$1',[userId])).rows[0].c || 0);
      if (enrolled > 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Role correction blocked: this student account has ${enrolled} enrollment record${enrolled===1?'':'s'}. Resolve the academic records before converting the account to Teacher.` }); }
      const { firstName, lastName, department } = req.body;
      if (![firstName,lastName].every(v=>String(v||'').trim())) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'First Name and Last Name are required for a Teacher profile.' }); }
      await client.query('DELETE FROM students WHERE id=$1',[userId]);
      await client.query(`INSERT INTO teachers(id,first_name,last_name,department) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,department=EXCLUDED.department`,[userId,String(firstName).trim(),String(lastName).trim(),String(department||'').trim()||null]);
      await client.query(`UPDATE users SET role='teacher',approval_status='pending',is_active=TRUE,updated_at=now() WHERE id=$1`,[userId]);
    }
    await client.query('COMMIT');
    await audit(req,{action:'account_role_correction',recordType:'user',recordId:userId,previousValue:user.role,newValue:targetRole});
    res.json({ message: targetRole==='student' ? 'Account corrected to Student. Student profile created and account approved.' : 'Account corrected to Teacher. Teacher profile created and sent for administrator approval.' });
  } catch(e) { try{await client.query('ROLLBACK');}catch{} next(e); } finally { client.release(); }
});

router.post('/users/:userId/approve', async (req,res,next)=>{try{const user=(await pool.query('SELECT * FROM users WHERE id=$1',[req.params.userId])).rows[0];if(!user)return res.status(404).json({error:'User not found.'});await pool.query(`UPDATE users SET approval_status='approved',updated_at=now() WHERE id=$1`,[user.id]);await audit(req,{action:'account_approval',recordType:'user',recordId:user.id,previousValue:user.approval_status,newValue:'approved'});res.json({message:'Account approved.'});}catch(e){next(e);}});
router.post('/users/:userId/reject', async (req,res,next)=>{try{const user=(await pool.query('SELECT * FROM users WHERE id=$1',[req.params.userId])).rows[0];if(!user)return res.status(404).json({error:'User not found.'});await pool.query(`UPDATE users SET approval_status='rejected',updated_at=now() WHERE id=$1`,[user.id]);await audit(req,{action:'account_approval',recordType:'user',recordId:user.id,previousValue:user.approval_status,newValue:'rejected'});res.json({message:'Account rejected.'});}catch(e){next(e);}});
router.post('/users/:userId/deactivate', async (req,res,next)=>{try{const user=(await pool.query('SELECT * FROM users WHERE id=$1',[req.params.userId])).rows[0];if(!user)return res.status(404).json({error:'User not found.'});await pool.query(`UPDATE users SET is_active=FALSE,updated_at=now() WHERE id=$1`,[user.id]);await audit(req,{action:'account_deactivation',recordType:'user',recordId:user.id});res.json({message:'Account deactivated.'});}catch(e){next(e);}});
router.post('/users/:userId/reactivate', async (req,res,next)=>{try{await pool.query(`UPDATE users SET is_active=TRUE,updated_at=now() WHERE id=$1`,[req.params.userId]);await audit(req,{action:'account_deactivation',recordType:'user',recordId:req.params.userId,newValue:'reactivated'});res.json({message:'Account reactivated.'});}catch(e){next(e);}});
router.post('/users/:userId/reset-password', async (req,res,next)=>{try{const {newPassword}=req.body;if(!newPassword||newPassword.length<8)return res.status(400).json({error:'Password must be at least 8 characters.'});const hash=bcrypt.hashSync(newPassword,12);await pool.query(`UPDATE users SET password_hash=$1,failed_login_attempts=0,locked_until=NULL WHERE id=$2`,[hash,req.params.userId]);await audit(req,{action:'score_modification',recordType:'user_password',recordId:req.params.userId});res.json({message:'Password reset.'});}catch(e){next(e);}});
router.get('/classes',async(req,res,next)=>{try{const {rows}=await pool.query(`SELECT c.*,t.first_name AS teacher_first,t.last_name AS teacher_last FROM classes c JOIN teachers t ON t.id=c.teacher_id ORDER BY c.created_at DESC`);res.json(rows);}catch(e){next(e);}});
router.get('/audit-log',async(req,res,next)=>{try{const limit=Math.min(parseInt(req.query.limit)||200,1000);res.json((await pool.query(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1`,[limit])).rows);}catch(e){next(e);}});
router.get('/dashboard',async(req,res,next)=>{try{const q=async sql=>(await pool.query(sql)).rows[0].c;const [totalStudents,totalTeachers,totalClasses,activeUsers,pendingRegistrations,attendanceSessions,finalizedGrades]=await Promise.all([q(`SELECT COUNT(*)::int c FROM students`),q(`SELECT COUNT(*)::int c FROM users WHERE role='teacher' AND approval_status='approved'`),q(`SELECT COUNT(*)::int c FROM classes WHERE is_active=TRUE`),q(`SELECT COUNT(*)::int c FROM users WHERE is_active=TRUE`),q(`SELECT COUNT(*)::int c FROM users WHERE approval_status='pending'`),q(`SELECT COUNT(*)::int c FROM attendance_sessions`),q(`SELECT COUNT(*)::int c FROM grade_status WHERE status IN ('finalized','released')`)]);res.json({totalStudents,totalTeachers,totalClasses,activeUsers,pendingRegistrations,attendanceSessions,finalizedGrades});}catch(e){next(e);}});
router.get('/terms',async(req,res,next)=>{try{res.json((await pool.query(`SELECT * FROM academic_terms ORDER BY academic_year DESC`)).rows);}catch(e){next(e);}});
router.post('/terms',async(req,res,next)=>{try{const {academicYear,semester,setCurrent}=req.body;const id=crypto.randomUUID();if(setCurrent)await pool.query(`UPDATE academic_terms SET is_current=FALSE`);await pool.query(`INSERT INTO academic_terms(id,academic_year,semester,is_current) VALUES($1,$2,$3,$4)`,[id,academicYear,semester,!!setCurrent]);await audit(req,{action:'class_creation',recordType:'academic_term',recordId:id,newValue:{academicYear,semester}});res.status(201).json({id,academicYear,semester});}catch(e){next(e);}});
module.exports=router;
