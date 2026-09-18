const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { audit } = require('../utils/audit');

router.use(authenticate, requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const teacherId = String(req.query.teacherId || '').trim();
    const status = String(req.query.status || '').trim();
    const params = [];
    const conditions = [];
    if (teacherId) {
      params.push(teacherId);
      conditions.push('r.teacher_id = $' + params.length);
    }
    if (status) {
      if (!['pending','approved','rejected','cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid request status.' });
      }
      params.push(status);
      conditions.push('r.status = $' + params.length);
    }
    let sql = 'SELECT r.*, c.subject, c.section, c.class_code, ' +
      's.first_name AS student_first, s.last_name AS student_last, s.student_number, ' +
      't.first_name AS teacher_first, t.last_name AS teacher_last, ' +
      'u.email AS teacher_email, reviewer.email AS reviewer_email ' +
      'FROM grade_unfinalize_requests r ' +
      'JOIN classes c ON c.id = r.class_id ' +
      'JOIN students s ON s.id = r.student_id ' +
      'JOIN teachers t ON t.id = r.teacher_id ' +
      'JOIN users u ON u.id = r.teacher_id ' +
      'LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by ';
    if (conditions.length) sql += 'WHERE ' + conditions.join(' AND ') + ' ';
    sql += "ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.requested_at DESC";
    res.json((await pool.query(sql, params)).rows);
  } catch (e) { next(e); }
});

router.post('/:requestId/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const note = String(req.body.note || '').trim() || null;
    await client.query('BEGIN');
    const request = (await client.query('SELECT * FROM grade_unfinalize_requests WHERE id=$1 FOR UPDATE', [req.params.requestId])).rows[0];
    if (!request) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Unfinalize request not found.' }); }
    if (request.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This request has already been reviewed.' }); }
    const grade = (await client.query('SELECT status FROM grade_status WHERE student_id=$1 AND class_id=$2 FOR UPDATE', [request.student_id, request.class_id])).rows[0];
    if (!grade || !['finalized','released'].includes(grade.status)) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'The learner grade is no longer finalized or released.' }); }
    await client.query("UPDATE grade_status SET status='in_progress', finalized_by=NULL, finalized_at=NULL, released_at=NULL WHERE student_id=$1 AND class_id=$2", [request.student_id, request.class_id]);
    await client.query("UPDATE grade_unfinalize_requests SET status='approved', reviewed_by=$1, reviewed_at=now(), admin_note=$2 WHERE id=$3", [req.user.id, note, request.id]);
    await client.query(`INSERT INTO audit_log(id,user_id,role,action,record_type,record_id,previous_value,new_value,ip_address,user_agent,created_at) VALUES($1,$2,$3,'grade_unfinalize_approved','grade_unfinalize_request',$4,$5,$6,$7,$8,now())`,[require('crypto').randomUUID(),req.user.id,req.user.role,request.id,JSON.stringify(grade.status),JSON.stringify({status:'in_progress',adminNote:note}),req.ip,req.headers['user-agent']||null]);
    await client.query('COMMIT');
    res.json({ message: 'Request approved. The learner grade is now In Progress and can be corrected by the teacher.' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally { client.release(); }
});

router.post('/:requestId/reject', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const note = String(req.body.note || '').trim();
    if (note.length < 3) return res.status(400).json({ error: 'Please provide a brief reason for rejecting the request.' });
    await client.query('BEGIN');
    const request = (await client.query('SELECT * FROM grade_unfinalize_requests WHERE id=$1 FOR UPDATE', [req.params.requestId])).rows[0];
    if (!request) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Unfinalize request not found.' }); }
    if (request.status !== 'pending') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This request has already been reviewed.' }); }
    await client.query("UPDATE grade_unfinalize_requests SET status='rejected', reviewed_by=$1, reviewed_at=now(), admin_note=$2 WHERE id=$3", [req.user.id, note, request.id]);
    await client.query(`INSERT INTO audit_log(id,user_id,role,action,record_type,record_id,previous_value,new_value,ip_address,user_agent,created_at) VALUES($1,$2,$3,'grade_unfinalize_rejected','grade_unfinalize_request',$4,NULL,$5,$6,$7,now())`,[require('crypto').randomUUID(),req.user.id,req.user.role,request.id,JSON.stringify({status:'rejected',note}),req.ip,req.headers['user-agent']||null]);
    await client.query('COMMIT');
    res.json({ message: 'Unfinalize request rejected. The learner grade remains locked.' });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    next(e);
  } finally { client.release(); }
});

module.exports = router;
