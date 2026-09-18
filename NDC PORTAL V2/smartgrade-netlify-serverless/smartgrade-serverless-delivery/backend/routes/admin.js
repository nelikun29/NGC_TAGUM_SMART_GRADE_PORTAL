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

router.get('/unfinalize-requests', async (req, res, next) => {
  try {
    const teacherId = String(req.query.teacherId || '').trim();
    const status = String(req.query.status || '').trim();
    const params = [];
    const conditions = [];

    if (teacherId) {
      params.push(teacherId);
      conditions.push('r.teacher_id = {try{res.json((await pool.query(`SELECT * FROM academic_terms ORDER BY academic_year DESC`)).rows);}catch(e){next(e);}});
router.post('/terms',async(req,res,next)=>{try{const {academicYear,semester,setCurrent}=req.body;const id=crypto.randomUUID();if(setCurrent)await pool.query(`UPDATE academic_terms SET is_current=FALSE`);await pool.query(`INSERT INTO academic_terms(id,academic_year,semester,is_current) VALUES($1,$2,$3,$4)`,[id,academicYear,semester,!!setCurrent]);await audit(req,{action:'class_creation',recordType:'academic_term',recordId:id,newValue:{academicYear,semester}});res.status(201).json({id,academicYear,semester});}catch(e){next(e);}});
module.exports=router;
 + params.length);
    }
    if (status) {
      if (!['pending', 'approved', 'rejected', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid request status.' });
      }
      params.push(status);
      conditions.push('r.status = {try{res.json((await pool.query(`SELECT * FROM academic_terms ORDER BY academic_year DESC`)).rows);}catch(e){next(e);}});
router.post('/terms',async(req,res,next)=>{try{const {academicYear,semester,setCurrent}=req.body;const id=crypto.randomUUID();if(setCurrent)await pool.query(`UPDATE academic_terms SET is_current=FALSE`);await pool.query(`INSERT INTO academic_terms(id,academic_year,semester,is_current) VALUES($1,$2,$3,$4)`,[id,academicYear,semester,!!setCurrent]);await audit(req,{action:'class_creation',recordType:'academic_term',recordId:id,newValue:{academicYear,semester}});res.status(201).json({id,academicYear,semester});}catch(e){next(e);}});
module.exports=router;
 + params.length);
    }

    let sql = "SELECT r.*, c.subject, c.section, c.class_code, " +
      "s.first_name AS student_first, s.last_name AS student_last, s.student_number, " +
      "t.first_name AS teacher_first, t.last_name AS teacher_last, " +
      "u.email AS teacher_email, reviewer.email AS reviewer_email " +
      "FROM grade_unfinalize_requests r " +
      "JOIN classes c ON c.id = r.class_id " +
      "JOIN students s ON s.id = r.student_id " +
      "JOIN teachers t ON t.id = r.teacher_id " +
      "JOIN users u ON u.id = r.teacher_id " +
      "LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by ";
    if (conditions.length) sql += 'WHERE ' + conditions.join(' AND ') + ' ';
    sql += "ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.requested_at DESC";

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/unfinalize-requests/:requestId/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const note = String(req.body.note || '').trim() || null;
    await client.query('BEGIN');
    const request = (await client.query('SELECT * FROM grade_unfinalize_requests WHERE id=$1 FOR UPDATE', [req.params.requestId])).rows[0];
    if (!request) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Unfinalize request not found.' }); }
    if (request.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This request has already been reviewed.' }); }
    const grade = (await client.query('SELECT status FROM grade_status WHERE student_id=$1 AND class_id=$2 FOR UPDATE', [request.student_id, request.class_id])).rows[0];
    if (!grade || !['finalized', 'released'].includes(grade.status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The learner grade is no longer finalized or released.' }); }
    await client.query("UPDATE grade_status SET status='in_progress', finalized_by=NULL, finalized_at=NULL, released_at=NULL WHERE student_id=$1 AND class_id=$2", [request.student_id, request.class_id]);
    await client.query("UPDATE grade_unfinalize_requests SET status='approved', reviewed_by=$1, reviewed_at=now(), admin_note=$2 WHERE id=$3", [req.user.id, note, request.id]);
    await client.query('COMMIT');
    await audit(req, { action: 'grade_unfinalize_approved', recordType: 'grade_unfinalize_request', recordId: request.id, previousValue: grade.status, newValue: 'in_progress' });
    res.json({ message: 'Request approved. The learner grade is now In Progress and can be corrected by the teacher.' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally { client.release(); }
});

router.post('/unfinalize-requests/:requestId/reject', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const note = String(req.body.note || '').trim();
    if (note.length < 3) return res.status(400).json({ error: 'Please provide a brief reason for rejecting the request.' });
    await client.query('BEGIN');
    const request = (await client.query('SELECT * FROM grade_unfinalize_requests WHERE id=$1 FOR UPDATE', [req.params.requestId])).rows[0];
    if (!request) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Unfinalize request not found.' }); }
    if (request.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This request has already been reviewed.' }); }
    await client.query("UPDATE grade_unfinalize_requests SET status='rejected', reviewed_by=$1, reviewed_at=now(), admin_note=$2 WHERE id=$3", [req.user.id, note, request.id]);
    await client.query('COMMIT');
    await audit(req, { action: 'grade_unfinalize_rejected', recordType: 'grade_unfinalize_request', recordId: request.id, newValue: { status: 'rejected', note } });
    res.json({ message: 'Unfinalize request rejected. The learner grade remains locked.' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally { client.release(); }
});

router.get('/terms',async(req,res,next)=>{try{res.json((await pool.query(`SELECT * FROM academic_terms ORDER BY academic_year DESC`)).rows);}catch(e){next(e);}});
router.post('/terms',async(req,res,next)=>{try{const {academicYear,semester,setCurrent}=req.body;const id=crypto.randomUUID();if(setCurrent)await pool.query(`UPDATE academic_terms SET is_current=FALSE`);await pool.query(`INSERT INTO academic_terms(id,academic_year,semester,is_current) VALUES($1,$2,$3,$4)`,[id,academicYear,semester,!!setCurrent]);await audit(req,{action:'class_creation',recordType:'academic_term',recordId:id,newValue:{academicYear,semester}});res.status(201).json({id,academicYear,semester});}catch(e){next(e);}});
module.exports=router;
