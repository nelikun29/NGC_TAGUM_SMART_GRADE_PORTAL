const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { authenticate, requireRole, requireClassOwnership } = require('../middleware/auth');
const { audit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

const n = v => Number(v);
const validWeight = v => Number.isFinite(n(v)) && n(v) >= 0 && n(v) <= 100;
const keyOf = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

async function loadScheme(classId) {
  const scheme = (await pool.query('SELECT * FROM grading_schemes WHERE class_id=$1', [classId])).rows[0];
  if (!scheme) return null;
  const components = (await pool.query('SELECT * FROM grading_components WHERE scheme_id=$1 ORDER BY sort_order,name', [scheme.id])).rows;
  for (const c of components) {
    c.subcomponents = (await pool.query('SELECT * FROM grading_subcomponents WHERE component_id=$1 ORDER BY sort_order,name', [c.id])).rows;
  }
  return { ...scheme, components };
}

router.get('/:classId', requireClassOwnership, async (req,res,next) => {
  try { res.json({ scheme: await loadScheme(req.params.classId) }); } catch(e) { next(e); }
});

router.post('/:classId/initialize', requireRole('teacher','admin'), requireClassOwnership, async (req,res,next) => {
  const client = await pool.connect();
  try {
    const { classId } = req.params;
    await client.query('BEGIN');
    let scheme = (await client.query('SELECT * FROM grading_schemes WHERE class_id=$1 FOR UPDATE', [classId])).rows[0];
    if (!scheme) {
      const legacy = (await client.query('SELECT * FROM grading_weights WHERE class_id=$1', [classId])).rows[0] || {attendance_weight:10,quiz_weight:20,performance_weight:30,exam_weight:40};
      const sid = crypto.randomUUID();
      scheme = (await client.query(`INSERT INTO grading_schemes(id,class_id,name,state,created_by) VALUES($1,$2,$3,'draft',$4) RETURNING *`, [sid,classId,'Class Grading Scheme',req.user.id])).rows[0];
      const defs = [
        ['Attendance','attendance',legacy.attendance_weight,'attendance'],
        ['Quizzes','quiz',legacy.quiz_weight,'quiz'],
        ['Performance Tasks','performance',legacy.performance_weight,'performance'],
        ['Examination','exam',legacy.exam_weight,'exam']
      ];
      for (let i=0;i<defs.length;i++) {
        const d=defs[i];
        await client.query(`INSERT INTO grading_components(id,scheme_id,name,component_key,weight,source_type,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7)`, [crypto.randomUUID(),sid,d[0],d[1],d[2],d[3],i]);
      }
    }
    await client.query('COMMIT');
    res.status(201).json({ scheme: await loadScheme(classId) });
  } catch(e) { await client.query('ROLLBACK'); next(e); } finally { client.release(); }
});

router.put('/:classId', requireRole('teacher','admin'), requireClassOwnership, async (req,res,next) => {
  const client = await pool.connect();
  try {
    const { classId }=req.params;
    const { name, components }=req.body;
    if (!Array.isArray(components) || !components.length) return res.status(400).json({error:'At least one grading component is required.'});
    const active=components.filter(c=>c.isActive !== false);
    if (active.some(c=>!validWeight(c.weight))) return res.status(400).json({error:'Each component weight must be between 0 and 100.'});
    const total=active.reduce((s,c)=>s+n(c.weight),0);
    if (Math.abs(total-100)>0.01) return res.status(400).json({error:`Active grading component weights must total exactly 100%. Current total: ${total}%.`});
    const keys=new Set();
    for (const c of components) {
      const key=keyOf(c.componentKey || c.name);
      if (!key || keys.has(key)) return res.status(400).json({error:'Component names/keys must be unique and non-empty.'});
      keys.add(key);
      const subs=(c.subcomponents||[]).filter(s=>s.isActive !== false);
      if (subs.length) {
        if (subs.some(s=>!validWeight(s.weightShare))) return res.status(400).json({error:`Invalid subcomponent weight in ${c.name}.`});
        const st=subs.reduce((s,x)=>s+n(x.weightShare),0);
        if (Math.abs(st-100)>0.01) return res.status(400).json({error:`Subcomponents of ${c.name} must total exactly 100%. Current total: ${st}%.`});
      }
    }
    await client.query('BEGIN');
    const scheme=(await client.query('SELECT * FROM grading_schemes WHERE class_id=$1 FOR UPDATE',[classId])).rows[0];
    if (!scheme) { await client.query('ROLLBACK'); return res.status(409).json({error:'Initialize the grading scheme first.'}); }
    if (scheme.state==='finalized') { await client.query('ROLLBACK'); return res.status(409).json({error:'This grading scheme is finalized and cannot be edited.'}); }
    await client.query('UPDATE grading_schemes SET name=$1,version=version+1,updated_at=now() WHERE id=$2',[String(name||scheme.name).trim()||scheme.name,scheme.id]);
    await client.query('DELETE FROM grading_components WHERE scheme_id=$1',[scheme.id]);
    for (let i=0;i<components.length;i++) {
      const c=components[i], cid=crypto.randomUUID(), key=keyOf(c.componentKey||c.name);
      const source=['attendance','quiz','performance','exam','custom'].includes(c.sourceType)?c.sourceType:'custom';
      const method=['average_percentage','points_total'].includes(c.calculationMethod)?c.calculationMethod:'average_percentage';
      await client.query(`INSERT INTO grading_components(id,scheme_id,name,component_key,weight,source_type,calculation_method,sort_order,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[cid,scheme.id,String(c.name||'').trim(),key,n(c.weight),source,method,i,c.isActive!==false]);
      const subs=c.subcomponents||[];
      for(let j=0;j<subs.length;j++) {
        const s=subs[j];
        await client.query(`INSERT INTO grading_subcomponents(id,component_id,name,subcomponent_key,weight_share,source_filter,sort_order,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[crypto.randomUUID(),cid,String(s.name||'').trim(),keyOf(s.subcomponentKey||s.name),n(s.weightShare),s.sourceFilter||null,j,s.isActive!==false]);
      }
    }
    await client.query('COMMIT');
    await audit(req,{action:'grading_scheme_update',recordType:'grading_scheme',recordId:scheme.id,newValue:{classId,total,components:components.length}});
    res.json({scheme:await loadScheme(classId)});
  } catch(e) { try{await client.query('ROLLBACK');}catch{} next(e); } finally { client.release(); }
});

router.post('/:classId/state', requireRole('teacher','admin'), requireClassOwnership, async (req,res,next) => {
  try {
    const state=String(req.body.state||'');
    if (!['draft','active','finalized'].includes(state)) return res.status(400).json({error:'Invalid grading scheme state.'});
    const scheme=(await pool.query('SELECT * FROM grading_schemes WHERE class_id=$1',[req.params.classId])).rows[0];
    if(!scheme) return res.status(404).json({error:'Grading scheme not found.'});
    if(scheme.state==='finalized' && state!=='finalized') return res.status(409).json({error:'A finalized grading scheme cannot be reopened through this endpoint.'});
    await pool.query('UPDATE grading_schemes SET state=$1,version=version+1,updated_at=now() WHERE id=$2',[state,scheme.id]);
    await audit(req,{action:'grading_scheme_state',recordType:'grading_scheme',recordId:scheme.id,previousValue:scheme.state,newValue:state});
    res.json({scheme:await loadScheme(req.params.classId)});
  } catch(e){next(e);}
});

module.exports=router;
