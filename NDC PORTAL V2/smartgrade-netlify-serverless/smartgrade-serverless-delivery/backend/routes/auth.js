const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');
const { JWT_SECRET, authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../utils/audit');
const { isNonEmptyString, isEmail } = require('../utils/validate');
const { sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();

function requireStudentRole(req,res,next){
  if (!req.user || req.user.role !== 'student') return res.status(403).json({ error:'Student access required.' });
  next();
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
}

// ---------- STUDENT REGISTRATION ----------
router.post('/register/student', async (req, res, next) => {
  try {
    const { studentNumber, firstName, middleName, lastName, yearLevel, roomNumber, email, password } = req.body;

    if (![studentNumber, firstName, lastName, yearLevel, email, password].every(v => isNonEmptyString(String(v || '')))) {
      return res.status(400).json({ error: 'All required fields must be filled in.' });
    }
    if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const normalizedStudentNumber = String(studentNumber).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedFirst = String(firstName).trim();
    const normalizedMiddle = String(middleName || '').trim();
    const normalizedLast = String(lastName).trim();

    const dupId = await pool.query(`SELECT id FROM students WHERE student_number = $1`, [normalizedStudentNumber]);
    if (dupId.rows[0]) return res.status(409).json({ error: 'This Student ID is already registered.' });

    const dupEmail = await pool.query(`SELECT id FROM users WHERE LOWER(BTRIM(email)) = $1`, [normalizedEmail]);
    if (dupEmail.rows[0]) return res.status(409).json({ error: 'This email is already registered.' });

    let possibleDuplicate = null;
    let verificationStatus = 'verified';

    const id = crypto.randomUUID();
    const hash = bcrypt.hashSync(password, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const normalizedNameKey = [normalizedFirst, normalizedMiddle, normalizedLast].join('|').toLowerCase();
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [normalizedNameKey]);
      possibleDuplicate = (await client.query(
        `SELECT id, student_number
         FROM students
         WHERE LOWER(BTRIM(first_name)) = LOWER($1)
           AND LOWER(BTRIM(COALESCE(middle_name, ''))) = LOWER($2)
           AND LOWER(BTRIM(last_name)) = LOWER($3)
         LIMIT 1`,
        [normalizedFirst, normalizedMiddle, normalizedLast]
      )).rows[0] || null;
      verificationStatus = possibleDuplicate ? 'possible_duplicate' : 'verified';
      await client.query(
        `INSERT INTO users (
           id, role, email, password_hash, approval_status,
           account_verification_status, verification_note
         ) VALUES ($1, 'student', $2, $3, 'approved', $4, $5)`,
        [
          id,
          normalizedEmail,
          hash,
          verificationStatus,
          possibleDuplicate ? 'Exact full-name match requires administrator review.' : null
        ]
      );
      await client.query(
        `INSERT INTO students (id, student_number, first_name, middle_name, last_name, year_level, room_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, normalizedStudentNumber, normalizedFirst, normalizedMiddle || null, normalizedLast, String(yearLevel).trim(), String(roomNumber || '').trim() || null]
      );
      if (possibleDuplicate) {
        await client.query(
          `INSERT INTO student_duplicate_reviews(
             id,candidate_user_id,matched_user_id,status,match_reason
           ) VALUES($1,$2,$3,'pending','exact_full_name')`,
          [crypto.randomUUID(), id, possibleDuplicate.id]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await audit(req, {
      action: possibleDuplicate ? 'student_registration_flagged' : 'student_registration',
      recordType: 'student',
      recordId: id,
      newValue: { studentNumber: normalizedStudentNumber, email: normalizedEmail, verificationStatus }
    });
    res.status(201).json({
      message: possibleDuplicate
        ? 'Registration received. You may sign in, but academic access will remain restricted until an administrator verifies the possible duplicate.'
        : 'Registration successful. You may now log in.',
      verificationStatus
    });
  } catch (e) {
    if (e && e.code === '23505') {
      const constraint=String(e.constraint||'');
      if (constraint.includes('student_number')) return res.status(409).json({ error:'This Student ID is already registered.' });
      return res.status(409).json({ error:'This email is already registered.' });
    }
    next(e);
  }
});

// ---------- STUDENT ID CLAIM ----------
// Used only when an official Student ID is already attached to another
// account. The claimant receives a restricted placeholder profile until an
// administrator verifies ownership and resolves the current holder's records.
router.post('/student-id-claims', async (req,res,next) => {
  const client=await pool.connect();
  try{
    const {studentNumber,firstName,middleName,lastName,yearLevel,roomNumber,email,password}=req.body||{};
    if(![studentNumber,firstName,lastName,yearLevel,email,password].every(v=>isNonEmptyString(String(v||''))))return res.status(400).json({error:'All required fields must be filled in.'});
    if(!isEmail(email))return res.status(400).json({error:'Please enter a valid email address.'});
    if(String(password).length<8)return res.status(400).json({error:'Password must be at least 8 characters.'});
    const normalizedStudentNumber=String(studentNumber).trim();
    const normalizedEmail=String(email).trim().toLowerCase();
    const normalizedFirst=String(firstName).trim(),normalizedMiddle=String(middleName||'').trim(),normalizedLast=String(lastName).trim();
    await client.query('BEGIN');
    const emailOwner=(await client.query('SELECT id FROM users WHERE LOWER(BTRIM(email))=$1 FOR UPDATE',[normalizedEmail])).rows[0];
    if(emailOwner){await client.query('ROLLBACK');return res.status(409).json({error:'This email is already registered.'});}
    const currentHolder=(await client.query('SELECT id FROM students WHERE student_number=$1 FOR UPDATE',[normalizedStudentNumber])).rows[0];
    if(!currentHolder){await client.query('ROLLBACK');return res.status(409).json({error:'This Student ID is not currently registered. Use ordinary Student registration instead.'});}
    const activeClaim=(await client.query(`SELECT id FROM student_id_claims WHERE claimed_student_number=$1 AND status IN ('pending','under_review') FOR UPDATE`,[normalizedStudentNumber])).rows[0];
    if(activeClaim){await client.query('ROLLBACK');return res.status(409).json({error:'A recovery claim for this Student ID is already under administrator review.'});}
    const id=crypto.randomUUID(),claimId=crypto.randomUUID(),placeholder=`CLAIM-${id}`;
    const hash=bcrypt.hashSync(String(password),12);
    await client.query(`INSERT INTO users(id,role,email,password_hash,approval_status,account_verification_status,verification_note) VALUES($1,'student',$2,$3,'approved','under_review',$4)`,[id,normalizedEmail,hash,`Claiming official Student ID ${normalizedStudentNumber}; administrator verification required.`]);
    await client.query(`INSERT INTO students(id,student_number,first_name,middle_name,last_name,year_level,room_number) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,placeholder,normalizedFirst,normalizedMiddle||null,normalizedLast,String(yearLevel).trim(),String(roomNumber||'').trim()||null]);
    await client.query(`INSERT INTO student_id_claims(id,claimant_user_id,claimed_student_number,current_holder_user_id,status) VALUES($1,$2,$3,$4,'pending')`,[claimId,id,normalizedStudentNumber,currentHolder.id]);
    await client.query('COMMIT');
    await audit(req,{action:'student_id_claim_submitted',recordType:'student_id_claim',recordId:claimId,newValue:{claimantUserId:id,claimedStudentNumber:normalizedStudentNumber,currentHolderUserId:currentHolder.id}});
    res.status(201).json({message:'Student ID claim submitted. You may sign in to view its verification status, but academic access remains restricted.',claimId,verificationStatus:'under_review'});
  }catch(e){try{await client.query('ROLLBACK');}catch{}if(e&&e.code==='23505')return res.status(409).json({error:'This email or Student ID claim is already registered.'});next(e);}finally{client.release();}
});

// ---------- TEACHER REGISTRATION (requires admin approval) ----------
router.post('/register/teacher', async (req, res, next) => {
  try {
    const { firstName, lastName, department, email, password } = req.body;
    if (![firstName, lastName, email, password].every(v => isNonEmptyString(String(v || '')))) {
      return res.status(400).json({ error: 'All required fields must be filled in.' });
    }
    if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const normalizedEmail = String(email).trim().toLowerCase();
    const dupEmail = await pool.query(`SELECT id FROM users WHERE LOWER(BTRIM(email)) = $1`, [normalizedEmail]);
    if (dupEmail.rows[0]) return res.status(409).json({ error: 'This email is already registered.' });

    const id = crypto.randomUUID();
    const hash = bcrypt.hashSync(password, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (id, role, email, password_hash, approval_status) VALUES ($1, 'teacher', $2, $3, 'pending')`,
        [id, normalizedEmail, hash]
      );
      await client.query(
        `INSERT INTO teachers (id, first_name, last_name, department) VALUES ($1, $2, $3, $4)`,
        [id, firstName, lastName, department || null]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await audit(req, { action: 'teacher_registration', recordType: 'teacher', recordId: id, newValue: { email: normalizedEmail } });
    res.status(201).json({ message: 'Registration submitted. An administrator must approve your account before you can log in.' });
  } catch (e) {
    if (e && e.code === '23505') return res.status(409).json({ error:'This email is already registered.' });
    next(e);
  }
});

// ---------- STUDENT PROFILE UPDATE ----------
router.put('/profile/student', authenticate, requireStudentRole, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { firstName, middleName, lastName, yearLevel, roomNumber, email } = req.body || {};
    if (![firstName, lastName, yearLevel, email].every(v => isNonEmptyString(String(v || '')))) {
      return res.status(400).json({ error: 'First name, last name, year level, and email are required.' });
    }
    if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    const normalizedFirst=String(firstName).trim(),normalizedMiddle=String(middleName||'').trim(),normalizedLast=String(lastName).trim();
    const normalizedEmail=String(email).trim().toLowerCase();

    await client.query('BEGIN');
    const existing = (await client.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [req.user.id])).rows[0];
    const existingUser = (await client.query('SELECT id,email FROM users WHERE id=$1 FOR UPDATE', [req.user.id])).rows[0];
    if (!existing || !existingUser) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Student profile not found.' }); }

    const emailOwner=(await client.query('SELECT id FROM users WHERE LOWER(BTRIM(email))=$1 AND id<>$2 LIMIT 1',[normalizedEmail,req.user.id])).rows[0];
    if(emailOwner){ await client.query('ROLLBACK'); return res.status(409).json({ error:'This email is already registered to another account.' }); }

    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[[normalizedFirst,normalizedMiddle,normalizedLast].join('|').toLowerCase()]);
    const duplicateName=(await client.query(`SELECT id FROM students WHERE id<>$1 AND LOWER(BTRIM(first_name))=LOWER($2) AND LOWER(BTRIM(COALESCE(middle_name,'')))=LOWER($3) AND LOWER(BTRIM(last_name))=LOWER($4) LIMIT 1`,[req.user.id,normalizedFirst,normalizedMiddle,normalizedLast])).rows[0]||null;
    const updated = (await client.query(
      `UPDATE students SET first_name=$1,middle_name=$2,last_name=$3,year_level=$4,room_number=$5 WHERE id=$6 RETURNING *`,
      [normalizedFirst, normalizedMiddle || null, normalizedLast, String(yearLevel).trim(), String(roomNumber || '').trim() || null, req.user.id]
    )).rows[0];

    await client.query('UPDATE users SET email=$1,updated_at=now() WHERE id=$2',[normalizedEmail,req.user.id]);

    if(duplicateName){
      await client.query(`UPDATE users SET account_verification_status='possible_duplicate',verification_note='Exact full-name match requires administrator review.',updated_at=now() WHERE id=$1`,[req.user.id]);
      await client.query(`INSERT INTO student_duplicate_reviews(id,candidate_user_id,matched_user_id,status,match_reason) VALUES($1,$2,$3,'pending','profile_update_exact_full_name') ON CONFLICT DO NOTHING`,[crypto.randomUUID(),req.user.id,duplicateName.id]);
    }

    await client.query('COMMIT');
    await audit(req, { action:'student_profile_updated', recordType:'student', recordId:req.user.id,
      previousValue:{first_name:existing.first_name,middle_name:existing.middle_name,last_name:existing.last_name,year_level:existing.year_level,room_number:existing.room_number,email:existingUser.email},
      newValue:{first_name:updated.first_name,middle_name:updated.middle_name,last_name:updated.last_name,year_level:updated.year_level,room_number:updated.room_number,email:normalizedEmail} });

    const nextVerificationStatus=duplicateName?'possible_duplicate':(req.user.accountVerificationStatus||'verified');
    res.json({
      message:nextVerificationStatus!=='verified'?'Profile updated. Academic access remains restricted until the account review is completed.':'Profile and email updated successfully.',
      profile:updated,
      email:normalizedEmail,
      accountVerificationStatus:nextVerificationStatus,
      verificationNote:duplicateName?'Exact full-name match requires administrator review.':(req.user.verificationNote||null)
    });
  } catch (e) {
    try{await client.query('ROLLBACK');}catch{}
    if(e&&e.code==='23505') return res.status(409).json({error:'This email is already registered to another account.'});
    next(e);
  } finally { client.release(); }
});

// ---------- TEACHER PROFILE UPDATE ----------
router.put('/profile/teacher', authenticate, requireRole('teacher'), async (req,res,next)=>{
  const client=await pool.connect();
  try{
    const {firstName,lastName,department,email}=req.body||{};
    if(![firstName,lastName,email].every(v=>isNonEmptyString(String(v||'')))){
      return res.status(400).json({error:'First name, last name, and email are required.'});
    }
    if(!isEmail(email)) return res.status(400).json({error:'Please enter a valid email address.'});

    const normalizedEmail=String(email).trim().toLowerCase();
    const normalizedFirst=String(firstName).trim();
    const normalizedLast=String(lastName).trim();
    const normalizedDepartment=String(department||'').trim();

    await client.query('BEGIN');
    const existingTeacher=(await client.query('SELECT * FROM teachers WHERE id=$1 FOR UPDATE',[req.user.id])).rows[0];
    const existingUser=(await client.query('SELECT id,email FROM users WHERE id=$1 FOR UPDATE',[req.user.id])).rows[0];
    if(!existingTeacher||!existingUser){
      await client.query('ROLLBACK');
      return res.status(404).json({error:'Teacher profile not found.'});
    }

    const emailOwner=(await client.query(
      'SELECT id FROM users WHERE LOWER(BTRIM(email))=$1 AND id<>$2 LIMIT 1',
      [normalizedEmail,req.user.id]
    )).rows[0];
    if(emailOwner){
      await client.query('ROLLBACK');
      return res.status(409).json({error:'This email is already registered to another account.'});
    }

    const updated=(await client.query(
      `UPDATE teachers SET first_name=$1,last_name=$2,department=$3 WHERE id=$4 RETURNING *`,
      [normalizedFirst,normalizedLast,normalizedDepartment||null,req.user.id]
    )).rows[0];

    await client.query(
      'UPDATE users SET email=$1,updated_at=now() WHERE id=$2',
      [normalizedEmail,req.user.id]
    );

    await client.query('COMMIT');

    await audit(req,{
      action:'teacher_profile_updated',
      recordType:'teacher',
      recordId:req.user.id,
      previousValue:{
        first_name:existingTeacher.first_name,
        last_name:existingTeacher.last_name,
        department:existingTeacher.department,
        email:existingUser.email
      },
      newValue:{
        first_name:updated.first_name,
        last_name:updated.last_name,
        department:updated.department,
        email:normalizedEmail
      }
    });

    res.json({
      message:'Profile and email updated successfully.',
      profile:updated,
      email:normalizedEmail
    });
  }catch(e){
    try{await client.query('ROLLBACK');}catch{}
    if(e&&e.code==='23505') return res.status(409).json({error:'This email is already registered to another account.'});
    next(e);
  }finally{
    client.release();
  }
});

// ---------- EMAIL PASSWORD RESET ----------
router.post('/forgot-password', async (req, res, next) => {
  try {
    const normalizedEmail = String((req.body || {}).email || '').trim().toLowerCase();
    const generic = { message: 'If this email is registered and active, a password reset link will be sent to it.' };
    if (!isEmail(normalizedEmail)) return res.json(generic);

    const user = (await pool.query('SELECT id,email,is_active FROM users WHERE lower(email)=$1', [normalizedEmail])).rows[0];
    if (!user || !user.is_active) return res.json(generic);

    const appBaseUrl=String(process.env.APP_BASE_URL||'').trim().replace(/\/$/,'');
    if(!appBaseUrl){
      console.error('[auth/forgot-password] APP_BASE_URL is not configured.');
      return res.json(generic);
    }

    const rawToken=crypto.randomBytes(32).toString('hex');
    const tokenHash=crypto.createHash('sha256').update(rawToken).digest('hex');
    const requestId=crypto.randomUUID();

    const existing=(await pool.query("SELECT id FROM password_reset_requests WHERE user_id=$1 AND status='pending'",[user.id])).rows[0];
    if(existing){
      await pool.query(
        `UPDATE password_reset_requests
         SET requested_at=now(),token_hash=$1,token_expires_at=now()+interval '30 minutes',email_sent_at=NULL
         WHERE id=$2`,
        [tokenHash,existing.id]
      );
    }else{
      await pool.query(
        `INSERT INTO password_reset_requests(id,user_id,status,token_hash,token_expires_at)
         VALUES($1,$2,'pending',$3,now()+interval '30 minutes')`,
        [requestId,user.id,tokenHash]
      );
    }

    const resetUrl=appBaseUrl+'?resetToken='+encodeURIComponent(rawToken);
    try{
      await sendPasswordResetEmail({to:user.email,resetUrl});
      await pool.query(
        `UPDATE password_reset_requests SET email_sent_at=now()
         WHERE user_id=$1 AND status='pending'`,
        [user.id]
      );
    }catch(emailError){
      console.error('[auth/forgot-password] email send failed',emailError);
    }

    res.json(generic);
  } catch (e) { next(e); }
});

router.post('/reset-password', async (req,res,next)=>{
  const client=await pool.connect();
  try{
    const token=String((req.body||{}).token||'').trim();
    const newPassword=String((req.body||{}).newPassword||'');
    const confirmPassword=String((req.body||{}).confirmPassword||'');

    if(!token) return res.status(400).json({error:'Reset token is required.'});
    if(newPassword.length<8) return res.status(400).json({error:'Password must be at least 8 characters.'});
    if(newPassword!==confirmPassword) return res.status(400).json({error:'Passwords do not match.'});

    const tokenHash=crypto.createHash('sha256').update(token).digest('hex');

    await client.query('BEGIN');
    const request=(await client.query(
      `SELECT * FROM password_reset_requests
       WHERE token_hash=$1 AND status='pending' AND token_expires_at>now()
       FOR UPDATE`,
      [tokenHash]
    )).rows[0];

    if(!request){
      await client.query('ROLLBACK');
      return res.status(400).json({error:'This password reset link is invalid or has expired.'});
    }

    const hash=bcrypt.hashSync(newPassword,12);
    await client.query(
      'UPDATE users SET password_hash=$1,failed_login_attempts=0,locked_until=NULL,updated_at=now() WHERE id=$2',
      [hash,request.user_id]
    );
    await client.query(
      `UPDATE password_reset_requests
       SET status='completed',resolved_at=now(),token_hash=NULL,token_expires_at=NULL
       WHERE id=$1`,
      [request.id]
    );
    await client.query('COMMIT');

    try{await audit(req,{action:'password_reset_email',recordType:'user',recordId:request.user_id,newValue:{reset:true,loginLockCleared:true}});}catch(e){console.error('[auth/reset-password] audit failed',e);}
    res.json({message:'Password updated successfully. You may now log in with your new password.'});
  }catch(e){
    try{await client.query('ROLLBACK');}catch{}
    next(e);
  }finally{
    client.release();
  }
});

router.get('/password-reset-requests', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT pr.id,pr.requested_at,u.id AS user_id,u.email,u.role,
             COALESCE(s.first_name,t.first_name,'') AS first_name,
             COALESCE(s.last_name,t.last_name,'') AS last_name
      FROM password_reset_requests pr JOIN users u ON u.id=pr.user_id
      LEFT JOIN students s ON s.id=u.id LEFT JOIN teachers t ON t.id=u.id
      WHERE pr.status='pending' ORDER BY pr.requested_at ASC
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/password-reset-requests/:requestId/complete', authenticate, requireRole('admin'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const newPassword = String((req.body || {}).newPassword || '');
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    await client.query('BEGIN');
    const request = (await client.query("SELECT * FROM password_reset_requests WHERE id=$1 AND status='pending' FOR UPDATE", [req.params.requestId])).rows[0];
    if (!request) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pending password reset request not found.' }); }
    const hash = bcrypt.hashSync(newPassword, 12);
    await client.query('UPDATE users SET password_hash=$1,failed_login_attempts=0,locked_until=NULL,updated_at=now() WHERE id=$2', [hash, request.user_id]);
    await client.query("UPDATE password_reset_requests SET status='completed',resolved_at=now(),resolved_by=$1 WHERE id=$2", [req.user.id, request.id]);
    await client.query('COMMIT');
    try { await audit(req,{action:'password_reset_admin',recordType:'user',recordId:request.user_id,newValue:{reset:true,loginLockCleared:true}}); } catch(e) { console.error('[auth/password-reset] audit failed',e); }
    res.json({ message: 'Password reset successfully. The account login lock was also cleared.' });
  } catch(e) { try{await client.query('ROLLBACK');}catch{} next(e); } finally { client.release(); }
});

router.post('/password-reset-requests/:requestId/dismiss', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const row=(await pool.query("UPDATE password_reset_requests SET status='dismissed',resolved_at=now(),resolved_by=$1 WHERE id=$2 AND status='pending' RETURNING user_id",[req.user.id,req.params.requestId])).rows[0];
    if(!row)return res.status(404).json({error:'Pending password reset request not found.'});
    try { await audit(req,{action:'password_reset_dismissed',recordType:'user',recordId:row.user_id}); } catch(e) { console.error('[auth/password-reset] audit failed',e); }
    res.json({message:'Password reset request dismissed.'});
  } catch(e){next(e);}
});

// ---------- LOGIN ----------
// The API already has a Netlify-compatible global request limiter. Login also
// enforces a persistent per-account 5-attempt/15-minute lockout below, so a
// second express-rate-limit middleware here is redundant and can fail before
// the route handler executes in the Netlify serverless request environment.
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!isNonEmptyString(String(email || '')) || !isNonEmptyString(String(password || ''))) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows } = await pool.query(`SELECT * FROM users WHERE lower(email) = $1`, [normalizedEmail]);
    const user = rows[0];
    const genericFail = () => res.status(401).json({ error: 'Invalid email or password.' });

    if (!user) return genericFail();
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: `Account temporarily locked due to repeated failed logins. Try again after ${user.locked_until}.` });
    }
    if (typeof user.password_hash !== 'string' || !user.password_hash) {
      console.error('[auth/login] Invalid password hash for user', user.id);
      return res.status(500).json({ error: 'Unable to complete login. Please contact an administrator.' });
    }
    const ok = bcrypt.compareSync(String(password), user.password_hash);
    if (!ok) {
      const attempts = Number(user.failed_login_attempts || 0) + 1;
      let lockedUntil = null;
      if (attempts >= MAX_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
      }
      await pool.query(`UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`, [attempts, lockedUntil, user.id]);
      await audit(req, { action: 'login_failed', recordType: 'user', recordId: user.id });
      return genericFail();
    }
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated. Contact an administrator.' });
    if (user.approval_status === 'pending') return res.status(403).json({ error: 'Your account is pending administrator approval.' });
    if (user.approval_status === 'rejected') return res.status(403).json({ error: 'Your registration was not approved. Contact an administrator.' });
    if (user.account_verification_status === 'rejected') return res.status(403).json({ error: 'This account did not pass identity verification. Contact an administrator.' });
    await pool.query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id]);
    let profile = null;
    if (user.role === 'student') profile = (await pool.query(`SELECT * FROM students WHERE id = $1`, [user.id])).rows[0] || null;
    if (user.role === 'teacher') profile = (await pool.query(`SELECT * FROM teachers WHERE id = $1`, [user.id])).rows[0] || null;
    const pendingClaim=user.role==='student'?(await pool.query(`SELECT id,claimed_student_number,status FROM student_id_claims WHERE claimant_user_id=$1 AND status IN ('pending','under_review') ORDER BY created_at DESC LIMIT 1`,[user.id])).rows[0]||null:null;
    const token = signToken(user);
    await audit(req, { action: 'login', recordType: 'user', recordId: user.id });
    res.json({ token, user: {
      id: user.id,
      role: user.role,
      email: user.email,
      profile,
      accountVerificationStatus: user.account_verification_status || 'verified',
      verificationNote: user.verification_note || null,
      studentIdClaim: pendingClaim
    } });
  } catch (e) {
    console.error('=== LOGIN FAILURE ===');
    console.error('Message:', e && e.message ? e.message : e);
    console.error('Stack:', e && e.stack ? e.stack : e);
    return res.status(500).json({ error: 'Unable to complete login. Please try again.' });
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await audit(req, { action: 'logout', recordType: 'user', recordId: req.user.id });
    res.json({ message: 'Logged out.' });
  } catch (e) { next(e); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    let profile = null;
    if (req.user.role === 'student') profile = (await pool.query(`SELECT * FROM students WHERE id = $1`, [req.user.id])).rows[0];
    if (req.user.role === 'teacher') profile = (await pool.query(`SELECT * FROM teachers WHERE id = $1`, [req.user.id])).rows[0];
    const studentIdClaim=req.user.role==='student'?(await pool.query(`SELECT id,claimed_student_number,status FROM student_id_claims WHERE claimant_user_id=$1 AND status IN ('pending','under_review') ORDER BY created_at DESC LIMIT 1`,[req.user.id])).rows[0]||null:null;
    res.json({ user: req.user, profile, studentIdClaim });
  } catch (e) { next(e); }
});

module.exports = router;
