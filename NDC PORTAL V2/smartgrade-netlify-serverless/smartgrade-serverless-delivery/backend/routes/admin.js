const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

async function accountInventory(client, userId) {
  const count = async (sql, params=[userId]) => Number((await client.query(sql, params)).rows[0].count || 0);
  return {
    enrollments: await count('SELECT COUNT(*)::int count FROM enrollments WHERE student_id=$1'),
    attendanceRecords: await count('SELECT COUNT(*)::int count FROM attendance_records WHERE student_id=$1'),
    quizScores: await count('SELECT COUNT(*)::int count FROM quiz_scores WHERE student_id=$1'),
    performanceScores: await count('SELECT COUNT(*)::int count FROM performance_scores WHERE student_id=$1'),
    examScores: await count('SELECT COUNT(*)::int count FROM exam_scores WHERE student_id=$1'),
    customAssessmentScores: await count('SELECT COUNT(*)::int count FROM custom_assessment_scores WHERE student_id=$1'),
    gradeStatuses: await count('SELECT COUNT(*)::int count FROM grade_status WHERE student_id=$1'),
    gradeAdjustments: await count('SELECT COUNT(*)::int count FROM grade_adjustments WHERE student_id=$1'),
    unfinalizeRequests: await count('SELECT COUNT(*)::int count FROM grade_unfinalize_requests WHERE student_id=$1'),
    auditEntries: await count('SELECT COUNT(*)::int count FROM audit_log WHERE user_id=$1 OR record_id=$1')
  };
}

async function refreshVerificationStatus(client, userId) {
  const unresolved=(await client.query(`SELECT status FROM student_duplicate_reviews
    WHERE (candidate_user_id=$1 OR matched_user_id=$1) AND status IN ('pending','under_review')
    ORDER BY CASE status WHEN 'under_review' THEN 0 ELSE 1 END LIMIT 1`,[userId])).rows[0];
  if(unresolved){
    await client.query(`UPDATE users SET account_verification_status=$2,verification_note='Exact full-name match requires administrator review.',updated_at=now() WHERE id=$1 AND account_verification_status<>'rejected'`,[userId,unresolved.status==='under_review'?'under_review':'possible_duplicate']);
  }else{
    await client.query(`UPDATE users SET account_verification_status='verified',verification_note=NULL,updated_at=now() WHERE id=$1 AND account_verification_status<>'rejected'`,[userId]);
  }
}

const ACADEMIC_TRANSFERS=[
  {table:'enrollments',keys:['class_id']},
  {table:'attendance_records',keys:['session_id']},
  {table:'quiz_scores',keys:['quiz_id']},
  {table:'performance_scores',keys:['task_id']},
  {table:'exam_scores',keys:['exam_id']},
  {table:'custom_assessment_scores',keys:['assessment_id']},
  {table:'grade_status',keys:['class_id']},
  {table:'grade_adjustments',keys:['class_id','component']}
];

async function academicTransferConflicts(client,sourceUserId,destinationUserId){
  const conflicts=[];
  for(const spec of ACADEMIC_TRANSFERS){
    const join=spec.keys.map(k=>`d.${k}=s.${k}`).join(' AND ');
    const count=Number((await client.query(`SELECT COUNT(*)::int count FROM ${spec.table} s JOIN ${spec.table} d ON ${join} WHERE s.student_id=$1 AND d.student_id=$2`,[sourceUserId,destinationUserId])).rows[0].count||0);
    if(count)conflicts.push({recordType:spec.table,count});
  }
  const pendingUnfinalize=Number((await client.query(`SELECT COUNT(*)::int count FROM grade_unfinalize_requests s JOIN grade_unfinalize_requests d ON d.class_id=s.class_id AND d.status='pending' WHERE s.student_id=$1 AND s.status='pending' AND d.student_id=$2`,[sourceUserId,destinationUserId])).rows[0].count||0);
  if(pendingUnfinalize)conflicts.push({recordType:'grade_unfinalize_requests',count:pendingUnfinalize});
  return conflicts;
}

async function transferAcademicRecords(client,sourceUserId,destinationUserId){
  const transferred={};
  for(const spec of ACADEMIC_TRANSFERS){
    const result=await client.query(`UPDATE ${spec.table} SET student_id=$1 WHERE student_id=$2`,[destinationUserId,sourceUserId]);
    transferred[spec.table]=Number(result.rowCount||0);
  }
  const unfinalize=await client.query('UPDATE grade_unfinalize_requests SET student_id=$1 WHERE student_id=$2',[destinationUserId,sourceUserId]);
  transferred.grade_unfinalize_requests=Number(unfinalize.rowCount||0);
  return transferred;
}

router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.role, u.email, u.is_active, u.approval_status,
             u.account_verification_status, u.verification_note, u.created_at,
             s.first_name AS s_first, s.middle_name AS s_middle, s.last_name AS s_last,
             s.student_number, s.year_level, s.room_number,
             t.first_name AS t_first, t.last_name AS t_last, t.department,
             dr.id AS duplicate_review_id, dr.status AS duplicate_review_status,
             CASE WHEN dr.candidate_user_id=u.id THEN dr.matched_user_id ELSE dr.candidate_user_id END AS matched_user_id,
             sc.id AS student_id_claim_id, sc.claimed_student_number, sc.status AS student_id_claim_status,
             CASE WHEN sc.claimant_user_id=u.id THEN 'claimant' WHEN sc.current_holder_user_id=u.id THEN 'current_holder' END AS student_id_claim_role
      FROM users u
      LEFT JOIN students s ON s.id = u.id
      LEFT JOIN teachers t ON t.id = u.id
      LEFT JOIN LATERAL (
        SELECT r.* FROM student_duplicate_reviews r
        WHERE (r.candidate_user_id=u.id OR r.matched_user_id=u.id)
          AND r.status IN ('pending','under_review')
        ORDER BY r.created_at ASC LIMIT 1
      ) dr ON TRUE
      LEFT JOIN LATERAL (
        SELECT c.* FROM student_id_claims c
        WHERE (c.claimant_user_id=u.id OR c.current_holder_user_id=u.id)
          AND c.status IN ('pending','under_review')
        ORDER BY c.created_at ASC LIMIT 1
      ) sc ON TRUE
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/account-integrity/claims/:claimId',async(req,res,next)=>{
  try{
    const claim=(await pool.query(`SELECT c.*,
      cu.email claimant_email,cs.student_number claimant_placeholder,cs.first_name claimant_first,cs.middle_name claimant_middle,cs.last_name claimant_last,
      hu.email holder_email,hs.student_number holder_student_number,hs.first_name holder_first,hs.middle_name holder_middle,hs.last_name holder_last
      FROM student_id_claims c
      JOIN users cu ON cu.id=c.claimant_user_id JOIN students cs ON cs.id=c.claimant_user_id
      JOIN users hu ON hu.id=c.current_holder_user_id JOIN students hs ON hs.id=c.current_holder_user_id
      WHERE c.id=$1`,[req.params.claimId])).rows[0];
    if(!claim)return res.status(404).json({error:'Student ID claim not found.'});
    const [claimantInventory,holderInventory,suggestedResult]=await Promise.all([
      accountInventory(pool,claim.claimant_user_id),accountInventory(pool,claim.current_holder_user_id),
      pool.query(`SELECT u.id,u.email,s.student_number,s.first_name,s.middle_name,s.last_name
        FROM students s JOIN users u ON u.id=s.id
        WHERE s.id NOT IN ($1,$2) AND u.is_active=TRUE AND u.account_verification_status<>'rejected'
          AND LOWER(BTRIM(s.first_name))=LOWER($3)
          AND LOWER(BTRIM(COALESCE(s.middle_name,'')))=LOWER($4)
          AND LOWER(BTRIM(s.last_name))=LOWER($5)
        ORDER BY s.student_number`,[claim.claimant_user_id,claim.current_holder_user_id,claim.holder_first,claim.holder_middle||'',claim.holder_last])
    ]);
    const suggestedDestinations=await Promise.all(suggestedResult.rows.map(async row=>({...row,inventory:await accountInventory(pool,row.id)})));
    res.json({claim,claimantInventory,holderInventory,suggestedDestinations});
  }catch(e){next(e);}
});

router.post('/account-integrity/claims/:claimId/reject',async(req,res,next)=>{
  const client=await pool.connect();
  try{
    const note=String((req.body||{}).note||'').trim();if(note.length<5)return res.status(400).json({error:'Enter a rejection reason of at least 5 characters.'});
    await client.query('BEGIN');
    const claim=(await client.query(`SELECT * FROM student_id_claims WHERE id=$1 FOR UPDATE`,[req.params.claimId])).rows[0];
    if(!claim||!['pending','under_review'].includes(claim.status)){await client.query('ROLLBACK');return res.status(409).json({error:'This claim has already been resolved.'});}
    await client.query(`UPDATE student_id_claims SET status='rejected',admin_note=$1,resolved_by=$2,resolved_at=now() WHERE id=$3`,[note,req.user.id,claim.id]);
    await client.query(`UPDATE users SET account_verification_status='rejected',verification_note=$1,is_active=FALSE,updated_at=now() WHERE id=$2`,[note,claim.claimant_user_id]);
    await client.query('COMMIT');
    await audit(req,{action:'student_id_claim_rejected',recordType:'student_id_claim',recordId:claim.id,newValue:{note,claimantUserId:claim.claimant_user_id}});
    res.json({message:'Student ID claim rejected. The restricted claimant account was deactivated; no records were deleted.'});
  }catch(e){try{await client.query('ROLLBACK');}catch{}next(e);}finally{client.release();}
});

router.post('/account-integrity/claims/:claimId/approve',async(req,res,next)=>{
  const client=await pool.connect();
  try{
    const destinationUserId=String((req.body||{}).recordDestinationUserId||'').trim()||null;
    const note=String((req.body||{}).note||'').trim();if(note.length<5)return res.status(400).json({error:'Enter a verification/recovery note of at least 5 characters.'});
    await client.query('BEGIN');
    const claim=(await client.query(`SELECT * FROM student_id_claims WHERE id=$1 FOR UPDATE`,[req.params.claimId])).rows[0];
    if(!claim||!['pending','under_review'].includes(claim.status)){await client.query('ROLLBACK');return res.status(409).json({error:'This claim has already been resolved.'});}
    const profiles=(await client.query('SELECT id,student_number FROM students WHERE id IN ($1,$2) FOR UPDATE',[claim.claimant_user_id,claim.current_holder_user_id])).rows;
    const claimant=profiles.find(p=>p.id===claim.claimant_user_id),holder=profiles.find(p=>p.id===claim.current_holder_user_id);
    if(!claimant||!holder||holder.student_number!==claim.claimed_student_number){await client.query('ROLLBACK');return res.status(409).json({error:'The claimed Student ID is no longer assigned to the reviewed holder. Refresh the case.'});}
    const holderInventory=await accountInventory(client,claim.current_holder_user_id);
    const holderAcademicTotal=Object.entries(holderInventory).filter(([key])=>key!=='auditEntries').reduce((sum,[,value])=>sum+Number(value||0),0);
    let transferred={};
    if(destinationUserId){
      if(destinationUserId===claim.current_holder_user_id){await client.query('ROLLBACK');return res.status(400).json({error:'Record destination cannot be the account being archived.'});}
      const destination=(await client.query(`SELECT s.id,u.is_active,u.account_verification_status FROM students s JOIN users u ON u.id=s.id WHERE s.id=$1 FOR UPDATE`,[destinationUserId])).rows[0];
      if(!destination||!destination.is_active||destination.account_verification_status==='rejected'){await client.query('ROLLBACK');return res.status(409).json({error:'Select an active verified destination account for the academic records.'});}
      const conflicts=await academicTransferConflicts(client,claim.current_holder_user_id,destinationUserId);
      if(conflicts.length){await client.query('ROLLBACK');return res.status(409).json({error:'Record transfer blocked because the destination already has overlapping academic records.',conflicts});}
      transferred=await transferAcademicRecords(client,claim.current_holder_user_id,destinationUserId);
    }else if(holderAcademicTotal>0){
      await client.query('ROLLBACK');return res.status(409).json({error:'The current holder has academic records. Select Student B or Student A’s legitimate account as the verified record owner before approval.',holderInventory});
    }
    const archivedStudentNumber=`ARCHIVED-${claim.id}-${claim.current_holder_user_id}`;
    await client.query('UPDATE students SET student_number=$1 WHERE id=$2',[archivedStudentNumber,claim.current_holder_user_id]);
    await client.query('UPDATE students SET student_number=$1 WHERE id=$2',[claim.claimed_student_number,claim.claimant_user_id]);
    await client.query(`UPDATE users SET account_verification_status='rejected',verification_note=$1,is_active=FALSE,updated_at=now() WHERE id=$2`,[`Student ID ${claim.claimed_student_number} recovered by verified claimant. ${note}`,claim.current_holder_user_id]);
    await client.query(`UPDATE users SET account_verification_status='verified',verification_note=NULL,is_active=TRUE,updated_at=now() WHERE id=$1`,[claim.claimant_user_id]);
    await client.query(`UPDATE student_id_claims SET status='approved',admin_note=$1,resolved_by=$2,resolved_at=now() WHERE id=$3`,[note,req.user.id,claim.id]);
    const related=(await client.query(`UPDATE student_duplicate_reviews SET status=CASE WHEN $2::text IS NOT NULL AND (candidate_user_id=$2 OR matched_user_id=$2) THEN 'records_consolidated' ELSE 'rejected' END,admin_note=$3,resolved_by=$4,resolved_at=now() WHERE status IN ('pending','under_review') AND (candidate_user_id=$1 OR matched_user_id=$1) RETURNING candidate_user_id,matched_user_id`,[claim.current_holder_user_id,destinationUserId,note,req.user.id])).rows;
    const affected=new Set([claim.claimant_user_id]);for(const row of related){if(row.candidate_user_id!==claim.current_holder_user_id)affected.add(row.candidate_user_id);if(row.matched_user_id!==claim.current_holder_user_id)affected.add(row.matched_user_id);}for(const id of affected)await refreshVerificationStatus(client,id);
    await client.query('COMMIT');
    await audit(req,{action:'student_id_claim_approved',recordType:'student_id_claim',recordId:claim.id,previousValue:{holderUserId:claim.current_holder_user_id,holderStudentNumber:claim.claimed_student_number},newValue:{claimantUserId:claim.claimant_user_id,studentNumber:claim.claimed_student_number,recordDestinationUserId:destinationUserId,transferred,note}});
    res.json({message:'Student ID authority restored to the verified claimant. The former holder was archived and deactivated; academic records were preserved.',transferred});
  }catch(e){try{await client.query('ROLLBACK');}catch{}if(e&&e.code==='23505')return res.status(409).json({error:'Recovery could not complete because a unique academic or Student ID record conflicts.'});next(e);}finally{client.release();}
});

router.get('/account-integrity/reviews/:reviewId', async (req,res,next) => {
  try {
    const review = (await pool.query(`
      SELECT r.*,
             ca.email AS candidate_email, cs.student_number AS candidate_student_number,
             cs.first_name AS candidate_first, cs.middle_name AS candidate_middle, cs.last_name AS candidate_last,
             ma.email AS matched_email, ms.student_number AS matched_student_number,
             ms.first_name AS matched_first, ms.middle_name AS matched_middle, ms.last_name AS matched_last
      FROM student_duplicate_reviews r
      JOIN users ca ON ca.id=r.candidate_user_id JOIN students cs ON cs.id=r.candidate_user_id
      JOIN users ma ON ma.id=r.matched_user_id JOIN students ms ON ms.id=r.matched_user_id
      WHERE r.id=$1
    `,[req.params.reviewId])).rows[0];
    if(!review)return res.status(404).json({error:'Duplicate-review case not found.'});
    const [candidateInventory,matchedInventory]=await Promise.all([
      accountInventory(pool,review.candidate_user_id),
      accountInventory(pool,review.matched_user_id)
    ]);
    res.json({review,candidateInventory,matchedInventory});
  } catch(e){next(e);}
});

router.post('/account-integrity/reviews/:reviewId/start', async (req,res,next) => {
  try {
    const row=(await pool.query(`UPDATE student_duplicate_reviews SET status='under_review'
      WHERE id=$1 AND status='pending' RETURNING *`,[req.params.reviewId])).rows[0];
    if(!row)return res.status(409).json({error:'This review is no longer pending.'});
    await pool.query(`UPDATE users SET account_verification_status='under_review',updated_at=now()
      WHERE id IN ($1,$2) AND account_verification_status<>'rejected'`,[row.candidate_user_id,row.matched_user_id]);
    await audit(req,{action:'duplicate_review_started',recordType:'student_duplicate_review',recordId:row.id});
    res.json({message:'Duplicate-account review started.'});
  } catch(e){next(e);}
});

router.post('/account-integrity/reviews/:reviewId/confirm-distinct', async (req,res,next) => {
  const client=await pool.connect();
  try {
    const note=String((req.body||{}).note||'').trim();
    if(note.length<5)return res.status(400).json({error:'Enter a review note of at least 5 characters.'});
    await client.query('BEGIN');
    const row=(await client.query(`SELECT * FROM student_duplicate_reviews WHERE id=$1 FOR UPDATE`,[req.params.reviewId])).rows[0];
    if(!row||!['pending','under_review'].includes(row.status)){await client.query('ROLLBACK');return res.status(409).json({error:'This review has already been resolved.'});}
    await client.query(`UPDATE student_duplicate_reviews SET status='confirmed_distinct',admin_note=$1,resolved_by=$2,resolved_at=now() WHERE id=$3`,[note,req.user.id,row.id]);
    await refreshVerificationStatus(client,row.candidate_user_id);
    await refreshVerificationStatus(client,row.matched_user_id);
    await client.query('COMMIT');
    await audit(req,{action:'duplicate_review_confirmed_distinct',recordType:'student_duplicate_review',recordId:row.id,newValue:{note}});
    res.json({message:'Both accounts were verified as different legitimate learners.'});
  }catch(e){try{await client.query('ROLLBACK');}catch{}next(e);}finally{client.release();}
});

router.post('/account-integrity/reviews/:reviewId/reject-account', async (req,res,next) => {
  const client=await pool.connect();
  try {
    const rejectedUserId=String((req.body||{}).rejectedUserId||'');
    const note=String((req.body||{}).note||'').trim();
    if(note.length<5)return res.status(400).json({error:'Enter a rejection reason of at least 5 characters.'});
    await client.query('BEGIN');
    const row=(await client.query('SELECT * FROM student_duplicate_reviews WHERE id=$1 FOR UPDATE',[req.params.reviewId])).rows[0];
    if(!row||!['pending','under_review'].includes(row.status)){await client.query('ROLLBACK');return res.status(409).json({error:'This review has already been resolved.'});}
    if(![row.candidate_user_id,row.matched_user_id].includes(rejectedUserId)){await client.query('ROLLBACK');return res.status(400).json({error:'Select one of the reviewed accounts.'});}
    const verifiedUserId=rejectedUserId===row.candidate_user_id?row.matched_user_id:row.candidate_user_id;
    await client.query(`UPDATE users SET account_verification_status='rejected',verification_note=$1,is_active=FALSE,updated_at=now() WHERE id=$2`,[note,rejectedUserId]);
    await client.query(`UPDATE student_duplicate_reviews SET status='rejected',admin_note=$1,resolved_by=$2,resolved_at=now() WHERE id=$3`,[note,req.user.id,row.id]);
    await refreshVerificationStatus(client,verifiedUserId);
    await client.query('COMMIT');
    await audit(req,{action:'duplicate_review_account_rejected',recordType:'student_duplicate_review',recordId:row.id,newValue:{rejectedUserId,note}});
    res.json({message:'The selected account was rejected and deactivated. No academic records were deleted.'});
  }catch(e){try{await client.query('ROLLBACK');}catch{}next(e);}finally{client.release();}
});

router.post('/account-integrity/reviews/:reviewId/restore-student-id', async (req,res,next) => {
  const client=await pool.connect();
  try {
    const legitimateUserId=String((req.body||{}).legitimateUserId||'');
    const legitimateStudentNumber=String((req.body||{}).legitimateStudentNumber||'').trim();
    const otherStudentNumber=String((req.body||{}).otherStudentNumber||'').trim();
    const note=String((req.body||{}).note||'').trim();
    if(!legitimateStudentNumber||!otherStudentNumber||legitimateStudentNumber===otherStudentNumber)return res.status(400).json({error:'Provide two different official Student IDs.'});
    if(note.length<5)return res.status(400).json({error:'Enter a recovery note of at least 5 characters.'});
    await client.query('BEGIN');
    const row=(await client.query('SELECT * FROM student_duplicate_reviews WHERE id=$1 FOR UPDATE',[req.params.reviewId])).rows[0];
    if(!row||!['pending','under_review'].includes(row.status)){await client.query('ROLLBACK');return res.status(409).json({error:'This review has already been resolved.'});}
    if(![row.candidate_user_id,row.matched_user_id].includes(legitimateUserId)){await client.query('ROLLBACK');return res.status(400).json({error:'Select one of the reviewed accounts as the legitimate learner.'});}
    const otherUserId=legitimateUserId===row.candidate_user_id?row.matched_user_id:row.candidate_user_id;
    const profiles=(await client.query('SELECT id,student_number FROM students WHERE id IN ($1,$2) FOR UPDATE',[legitimateUserId,otherUserId])).rows;
    if(profiles.length!==2){await client.query('ROLLBACK');return res.status(409).json({error:'Both student profiles are required for Student ID recovery.'});}
    const conflicts=(await client.query(`SELECT id,student_number FROM students WHERE student_number IN ($1,$2) AND id NOT IN ($3,$4)`,[legitimateStudentNumber,otherStudentNumber,legitimateUserId,otherUserId])).rows;
    if(conflicts.length){await client.query('ROLLBACK');return res.status(409).json({error:'One of the supplied Student IDs belongs to an account outside this review.'});}
    const before=Object.fromEntries(profiles.map(p=>[p.id,p.student_number]));
    const temporary=`__RECOVERY__${row.id}`;
    await client.query('UPDATE students SET student_number=$1 WHERE id=$2',[temporary,otherUserId]);
    await client.query('UPDATE students SET student_number=$1 WHERE id=$2',[legitimateStudentNumber,legitimateUserId]);
    await client.query('UPDATE students SET student_number=$1 WHERE id=$2',[otherStudentNumber,otherUserId]);
    await client.query(`UPDATE student_duplicate_reviews SET status='student_id_recovered',admin_note=$1,resolved_by=$2,resolved_at=now() WHERE id=$3`,[note,req.user.id,row.id]);
    await refreshVerificationStatus(client,legitimateUserId);
    await refreshVerificationStatus(client,otherUserId);
    await client.query('COMMIT');
    await audit(req,{action:'duplicate_review_student_id_recovered',recordType:'student_duplicate_review',recordId:row.id,previousValue:before,newValue:{[legitimateUserId]:legitimateStudentNumber,[otherUserId]:otherStudentNumber,note}});
    res.json({message:'Student IDs were reassigned transactionally. Academic records remain attached to their verified internal accounts.'});
  }catch(e){try{await client.query('ROLLBACK');}catch{}if(e&&e.code==='23505')return res.status(409).json({error:'One of the supplied Student IDs is already registered.'});next(e);}finally{client.release();}
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
    const openIntegrityCase=(await client.query(`SELECT 1 FROM student_duplicate_reviews WHERE status IN ('pending','under_review') AND (candidate_user_id=$1 OR matched_user_id=$1) UNION ALL SELECT 1 FROM student_id_claims WHERE status IN ('pending','under_review') AND (claimant_user_id=$1 OR current_holder_user_id=$1) LIMIT 1`,[userId])).rows[0];
    if(openIntegrityCase){await client.query('ROLLBACK');return res.status(409).json({error:'Role correction is locked while this account has an open Account Integrity review.'});}

    if (user.role === 'teacher' && targetRole === 'student') {
      const owned = Number((await client.query('SELECT COUNT(*)::int c FROM classes WHERE teacher_id=$1',[userId])).rows[0].c || 0);
      if (owned > 0) { await client.query('ROLLBACK'); return res.status(409).json({ error: `Role correction blocked: this teacher account owns ${owned} class${owned===1?'':'es'}. Reassign or resolve those classes before converting the account to Student.` }); }
      const { studentNumber, firstName, middleName, lastName, yearLevel, roomNumber } = req.body;
      if (![studentNumber,firstName,lastName,yearLevel].every(v=>String(v||'').trim())) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Student ID, First Name, Last Name, and Year Level are required.' }); }
      const duplicate = (await client.query('SELECT id FROM students WHERE student_number=$1 AND id<>$2',[String(studentNumber).trim(),userId])).rows[0];
      if (duplicate) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This Student ID is already registered to another account.' }); }
      const normalizedFirst=String(firstName).trim(),normalizedMiddle=String(middleName||'').trim(),normalizedLast=String(lastName).trim();
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[[normalizedFirst,normalizedMiddle,normalizedLast].join('|').toLowerCase()]);
      const duplicateName=(await client.query(`SELECT id FROM students WHERE id<>$1 AND LOWER(BTRIM(first_name))=LOWER($2) AND LOWER(BTRIM(COALESCE(middle_name,'')))=LOWER($3) AND LOWER(BTRIM(last_name))=LOWER($4) LIMIT 1`,[userId,normalizedFirst,normalizedMiddle,normalizedLast])).rows[0]||null;
      await client.query('DELETE FROM teachers WHERE id=$1',[userId]);
      await client.query(`INSERT INTO students(id,student_number,first_name,middle_name,last_name,year_level,room_number) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET student_number=EXCLUDED.student_number,first_name=EXCLUDED.first_name,middle_name=EXCLUDED.middle_name,last_name=EXCLUDED.last_name,year_level=EXCLUDED.year_level,room_number=EXCLUDED.room_number`,[userId,String(studentNumber).trim(),normalizedFirst,normalizedMiddle||null,normalizedLast,String(yearLevel).trim(),String(roomNumber||'').trim()||null]);
      await client.query(`UPDATE users SET role='student',approval_status='approved',is_active=TRUE,account_verification_status=$2,verification_note=$3,updated_at=now() WHERE id=$1`,[userId,duplicateName?'possible_duplicate':'verified',duplicateName?'Exact full-name match requires administrator review.':null]);
      if(duplicateName)await client.query(`INSERT INTO student_duplicate_reviews(id,candidate_user_id,matched_user_id,status,match_reason) VALUES($1,$2,$3,'pending','role_correction_exact_full_name') ON CONFLICT DO NOTHING`,[crypto.randomUUID(),userId,duplicateName.id]);
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
router.post('/users/:userId/reactivate', async (req,res,next)=>{try{const user=(await pool.query('SELECT account_verification_status FROM users WHERE id=$1',[req.params.userId])).rows[0];if(!user)return res.status(404).json({error:'User not found.'});if(user.account_verification_status==='rejected')return res.status(409).json({error:'This identity-rejected or archived account cannot be reactivated directly. Resolve it through Account Integrity review.'});await pool.query(`UPDATE users SET is_active=TRUE,updated_at=now() WHERE id=$1`,[req.params.userId]);await audit(req,{action:'account_deactivation',recordType:'user',recordId:req.params.userId,newValue:'reactivated'});res.json({message:'Account reactivated.'});}catch(e){next(e);}});
router.post('/users/:userId/reset-password', async (req,res,next)=>{try{const {newPassword}=req.body;if(!newPassword||newPassword.length<8)return res.status(400).json({error:'Password must be at least 8 characters.'});const hash=bcrypt.hashSync(newPassword,12);const updated=(await pool.query(`UPDATE users SET password_hash=$1,failed_login_attempts=0,locked_until=NULL,updated_at=now() WHERE id=$2 RETURNING id`,[hash,req.params.userId])).rows[0];if(!updated)return res.status(404).json({error:'User not found.'});await audit(req,{action:'password_reset_admin',recordType:'user',recordId:req.params.userId,newValue:{reset:true,loginLockCleared:true}});res.json({message:'Password reset successfully. Login lock cleared.'});}catch(e){next(e);}});
router.get('/classes',async(req,res,next)=>{try{const {rows}=await pool.query(`SELECT c.*,t.first_name AS teacher_first,t.last_name AS teacher_last FROM classes c JOIN teachers t ON t.id=c.teacher_id ORDER BY c.created_at DESC`);res.json(rows);}catch(e){next(e);}});
router.get('/audit-log',async(req,res,next)=>{try{const limit=Math.min(parseInt(req.query.limit)||200,1000);res.json((await pool.query(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1`,[limit])).rows);}catch(e){next(e);}});
router.get('/dashboard',async(req,res,next)=>{try{const q=async sql=>(await pool.query(sql)).rows[0].c;const [totalStudents,totalTeachers,totalClasses,activeUsers,pendingRegistrations,attendanceSessions,finalizedGrades]=await Promise.all([q(`SELECT COUNT(*)::int c FROM students`),q(`SELECT COUNT(*)::int c FROM users WHERE role='teacher' AND approval_status='approved'`),q(`SELECT COUNT(*)::int c FROM classes WHERE is_active=TRUE`),q(`SELECT COUNT(*)::int c FROM users WHERE is_active=TRUE`),q(`SELECT COUNT(*)::int c FROM users WHERE approval_status='pending'`),q(`SELECT COUNT(*)::int c FROM attendance_sessions`),q(`SELECT COUNT(*)::int c FROM grade_status WHERE status IN ('finalized','released')`)]);res.json({totalStudents,totalTeachers,totalClasses,activeUsers,pendingRegistrations,attendanceSessions,finalizedGrades});}catch(e){next(e);}});
router.get('/terms',async(req,res,next)=>{try{res.json((await pool.query(`SELECT * FROM academic_terms ORDER BY academic_year DESC`)).rows);}catch(e){next(e);}});
router.post('/terms',async(req,res,next)=>{try{const {academicYear,semester,setCurrent}=req.body;const id=crypto.randomUUID();if(setCurrent)await pool.query(`UPDATE academic_terms SET is_current=FALSE`);await pool.query(`INSERT INTO academic_terms(id,academic_year,semester,is_current) VALUES($1,$2,$3,$4)`,[id,academicYear,semester,!!setCurrent]);await audit(req,{action:'class_creation',recordType:'academic_term',recordId:id,newValue:{academicYear,semester}});res.status(201).json({id,academicYear,semester});}catch(e){next(e);}});
module.exports=router;
