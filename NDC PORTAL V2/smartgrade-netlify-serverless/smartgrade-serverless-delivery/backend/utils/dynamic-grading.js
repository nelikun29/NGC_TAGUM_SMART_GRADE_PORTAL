const { pool } = require('../db');

// Dynamic grading is opt-in. Legacy classes continue using utils/grading.js
// until a grading_schemes row exists and its state is active/finalized.
async function getDynamicScheme(classId) {
  try {
    const scheme = (await pool.query(`SELECT * FROM grading_schemes WHERE class_id=$1 AND state IN ('active','finalized')`, [classId])).rows[0];
    if (!scheme) return null;
    const components = (await pool.query(`SELECT * FROM grading_components WHERE scheme_id=$1 AND is_active=TRUE ORDER BY sort_order,name`, [scheme.id])).rows;
    for (const c of components) {
      c.subcomponents = (await pool.query(`SELECT * FROM grading_subcomponents WHERE component_id=$1 AND is_active=TRUE ORDER BY sort_order,name`, [c.id])).rows;
    }
    return { ...scheme, components };
  } catch (e) {
    // Before the migration is installed, the tables do not exist. Falling
    // back keeps every existing class operational during staged rollout.
    if (e && e.code === '42P01') return null;
    throw e;
  }
}

async function attendancePercent(studentId, classId) {
  const { rows } = await pool.query(`SELECT ar.status FROM attendance_records ar JOIN attendance_sessions s ON ar.session_id=s.id WHERE s.class_id=$1 AND ar.student_id=$2`, [classId, studentId]);
  const counted = rows.filter(r => r.status !== 'excused');
  if (!counted.length) return { percent:null, complete:false };
  const points = counted.reduce((sum,r)=>sum+(r.status==='present'?1:r.status==='late'?0.75:0),0);
  return { percent:(points/counted.length)*100, complete:true };
}

function summarize(rows, method='average_percentage') {
  const usable=rows.filter(r=>r.verification_status!=='pending' && r.verification_status!=='rejected');
  const scored=usable.filter(r=>r.raw_score!==null && r.raw_score!==undefined);
  if (!rows.length || !usable.length || scored.length<usable.length || !scored.length) return {percent:null,complete:false};
  if (method==='points_total') {
    const raw=scored.reduce((s,r)=>s+Number(r.raw_score),0), max=scored.reduce((s,r)=>s+Number(r.max_score),0);
    return {percent:max>0?(raw/max)*100:null,complete:max>0};
  }
  return {percent:scored.reduce((s,r)=>s+(Number(r.raw_score)/Number(r.max_score))*100,0)/scored.length,complete:true};
}

async function assessmentRows(studentId,classId,sourceType,sourceFilter=null) {
  if(sourceType==='quiz') return (await pool.query(`SELECT s.raw_score,q.total_items max_score,s.verification_status,NULL::text source_filter FROM quiz_scores s JOIN quizzes q ON q.id=s.quiz_id WHERE q.class_id=$1 AND s.student_id=$2`,[classId,studentId])).rows;
  if(sourceType==='performance') return (await pool.query(`SELECT s.raw_score,p.max_score,s.verification_status,NULL::text source_filter FROM performance_scores s JOIN performance_tasks p ON p.id=s.task_id WHERE p.class_id=$1 AND s.student_id=$2`,[classId,studentId])).rows;
  if(sourceType==='exam') {
    const rows=(await pool.query(`SELECT s.raw_score,e.max_score,s.verification_status,e.exam_type source_filter FROM exam_scores s JOIN examinations e ON e.id=s.exam_id WHERE e.class_id=$1 AND s.student_id=$2`,[classId,studentId])).rows;
    return sourceFilter ? rows.filter(r=>String(r.source_filter||'').toLowerCase()===String(sourceFilter).toLowerCase()) : rows;
  }
  if(sourceType==='custom') {
    return (await pool.query(`SELECT s.raw_score,a.max_score,s.verification_status,COALESCE(a.subcomponent_id::text,'') source_filter FROM custom_assessment_scores s JOIN custom_assessments a ON a.id=s.assessment_id WHERE a.class_id=$1 AND a.component_id=$2 AND s.student_id=$3`,[classId,sourceFilter.componentId,studentId])).rows;
  }
  return [];
}

async function componentResult(studentId,classId,c) {
  if(c.source_type==='attendance') return attendancePercent(studentId,classId);
  if(c.subcomponents && c.subcomponents.length) {
    let pct=0;
    for(const sub of c.subcomponents) {
      let rows;
      if(c.source_type==='custom') {
        rows=(await pool.query(`SELECT s.raw_score,a.max_score,s.verification_status FROM custom_assessment_scores s JOIN custom_assessments a ON a.id=s.assessment_id WHERE a.class_id=$1 AND a.component_id=$2 AND a.subcomponent_id=$3 AND s.student_id=$4`,[classId,c.id,sub.id,studentId])).rows;
      } else rows=await assessmentRows(studentId,classId,c.source_type,sub.source_filter || sub.name);
      const r=summarize(rows,c.calculation_method);
      if(!r.complete || r.percent===null) return {percent:null,complete:false};
      pct += r.percent * Number(sub.weight_share)/100;
    }
    return {percent:pct,complete:true};
  }
  const rows=c.source_type==='custom' ? await assessmentRows(studentId,classId,'custom',{componentId:c.id}) : await assessmentRows(studentId,classId,c.source_type);
  return summarize(rows,c.calculation_method);
}

async function computeDynamicClassGrade(studentId,classId) {
  const scheme=await getDynamicScheme(classId);
  if(!scheme) return null;
  const totalWeight=scheme.components.reduce((s,c)=>s+Number(c.weight),0);
  if(Math.abs(totalWeight-100)>0.01) return {complete:false,status:'configuration_error',missing:[],components:{},finalGrade:null,message:`Grading scheme weights total ${totalWeight}%, not 100%.`};
  const components={}; const missing=[]; let finalGrade=0;
  for(const c of scheme.components) {
    const r=await componentResult(studentId,classId,c);
    components[c.component_key]={name:c.name,percent:r.percent,weight:Number(c.weight),available:r.complete && r.percent!==null,adjusted:false};
    if(Number(c.weight)>0 && (!r.complete || r.percent===null)) missing.push(c.component_key);
    else if(Number(c.weight)>0) finalGrade += r.percent*Number(c.weight)/100;
  }
  const status=(await pool.query(`SELECT status FROM grade_status WHERE student_id=$1 AND class_id=$2`,[studentId,classId])).rows[0];
  if(missing.length) return {complete:false,status:status?status.status:'in_progress',missing,components,finalGrade:null,message:`Grade Incomplete — ${missing.map(k=>components[k]?.name||k).join(', ')} score pending.`,schemeId:scheme.id,schemeVersion:scheme.version};
  return {complete:true,status:status?status.status:'computed',missing:[],components,finalGrade:Math.round(finalGrade*100)/100,message:null,schemeId:scheme.id,schemeVersion:scheme.version};
}

module.exports={getDynamicScheme,computeDynamicClassGrade};
