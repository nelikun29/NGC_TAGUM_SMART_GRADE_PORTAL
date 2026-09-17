const { pool } = require('../db');

async function getDynamicScheme(classId) {
  try {
    const scheme=(await pool.query(`SELECT * FROM grading_schemes WHERE class_id=$1 AND state IN ('active','finalized')`,[classId])).rows[0];
    if(!scheme)return null;
    const components=(await pool.query(`SELECT * FROM grading_components WHERE scheme_id=$1 AND is_active=TRUE ORDER BY sort_order,name`,[scheme.id])).rows;
    for(const c of components)c.subcomponents=(await pool.query(`SELECT * FROM grading_subcomponents WHERE component_id=$1 AND is_active=TRUE ORDER BY sort_order,name`,[c.id])).rows;
    return {...scheme,components};
  } catch(e){if(e&&e.code==='42P01')return null;throw e;}
}

async function attendancePercent(studentId,classId,maxDays) {
  const denominator=Number(maxDays);
  if(!Number.isFinite(denominator)||denominator<=0)return {percent:null,complete:false,configurationError:'Attendance Total Required Days must be configured.'};
  const {rows}=await pool.query(`SELECT ar.status FROM attendance_records ar JOIN attendance_sessions s ON ar.session_id=s.id WHERE s.class_id=$1 AND ar.student_id=$2`,[classId,studentId]);
  const points=rows.reduce((sum,r)=>sum+(r.status==='present'?1:r.status==='late'?0.75:0),0);
  if(points>denominator)return {percent:null,complete:false,configurationError:`Recorded attendance (${points}) exceeds the configured Total Required Days (${denominator}). Update the attendance configuration before finalizing grades.`,earned:points,max:denominator};
  return {percent:(points/denominator)*100,complete:true,earned:points,max:denominator};
}

function summarize(rows,method='average_percentage',fixedDenominator=null) {
  const pending=rows.filter(r=>r.verification_status==='pending'||r.verification_status==='rejected');
  const eligible=rows.filter(r=>r.verification_status!=='pending'&&r.verification_status!=='rejected');
  const scored=eligible.filter(r=>r.raw_score!==null&&r.raw_score!==undefined);
  if(pending.length)return {percent:null,complete:false,pendingCount:pending.length};
  if(scored.some(r=>Number(r.max_score)<=0||Number(r.raw_score)<0||Number(r.raw_score)>Number(r.max_score)))return {percent:null,complete:false,invalidScore:true};

  const denominator=Number(fixedDenominator);
  if(Number.isFinite(denominator)&&denominator>0){
    const configuredMax=rows.reduce((s,r)=>s+(Number(r.max_score)||0),0);
    if(configuredMax>denominator+0.0001)return {percent:null,complete:false,configurationError:`Configured assessment maximum (${configuredMax}) exceeds the Overall Total Score (${denominator}).`,earned:scored.reduce((s,r)=>s+Number(r.raw_score),0),max:denominator,configuredMax};
    const earned=scored.reduce((s,r)=>s+Number(r.raw_score),0);
    if(earned>denominator+0.0001)return {percent:null,complete:false,configurationError:`Earned points (${earned}) exceed the Overall Total Score (${denominator}).`,earned,max:denominator,configuredMax};
    return {percent:(earned/denominator)*100,complete:true,earned,max:denominator,configuredMax};
  }

  if(!rows.length||scored.length<eligible.length||!scored.length)return {percent:null,complete:false};
  if(method==='points_total'){const raw=scored.reduce((s,r)=>s+Number(r.raw_score),0),max=scored.reduce((s,r)=>s+Number(r.max_score),0);return {percent:(raw/max)*100,complete:true,earned:raw,max};}
  return {percent:scored.reduce((s,r)=>s+(Number(r.raw_score)/Number(r.max_score))*100,0)/scored.length,complete:true};
}

async function assessmentRows(studentId,classId,sourceType,sourceFilter=null){
  if(sourceType==='quiz')return (await pool.query(`SELECT s.raw_score,q.total_items max_score,s.verification_status,NULL::text source_filter FROM quizzes q LEFT JOIN quiz_scores s ON s.quiz_id=q.id AND s.student_id=$2 WHERE q.class_id=$1`,[classId,studentId])).rows;
  if(sourceType==='performance')return (await pool.query(`SELECT s.raw_score,p.max_score,s.verification_status,NULL::text source_filter FROM performance_tasks p LEFT JOIN performance_scores s ON s.task_id=p.id AND s.student_id=$2 WHERE p.class_id=$1`,[classId,studentId])).rows;
  if(sourceType==='exam'){const rows=(await pool.query(`SELECT s.raw_score,e.max_score,s.verification_status,e.exam_type source_filter FROM examinations e LEFT JOIN exam_scores s ON s.exam_id=e.id AND s.student_id=$2 WHERE e.class_id=$1`,[classId,studentId])).rows;return sourceFilter?rows.filter(r=>String(r.source_filter||'').toLowerCase()===String(sourceFilter).toLowerCase()):rows;}
  if(sourceType==='custom')return (await pool.query(`SELECT s.raw_score,a.max_score,s.verification_status,COALESCE(a.subcomponent_id::text,'') source_filter FROM custom_assessments a LEFT JOIN custom_assessment_scores s ON s.assessment_id=a.id AND s.student_id=$3 WHERE a.class_id=$1 AND a.component_id=$2`,[classId,sourceFilter.componentId,studentId])).rows;
  return [];
}

async function componentResult(studentId,classId,c){
  if(c.source_type==='attendance')return attendancePercent(studentId,classId,c.max_points);
  if(c.subcomponents&&c.subcomponents.length){
    const componentWeight=Number(c.weight);if(!Number.isFinite(componentWeight)||componentWeight<=0)return {percent:null,complete:false,configurationError:'Component weight must be greater than 0 when subcomponents are used.'};
    let pct=0,earned=0,max=0;
    for(const sub of c.subcomponents){
      let rows;if(c.source_type==='custom')rows=(await pool.query(`SELECT s.raw_score,a.max_score,s.verification_status FROM custom_assessments a LEFT JOIN custom_assessment_scores s ON s.assessment_id=a.id AND s.student_id=$4 WHERE a.class_id=$1 AND a.component_id=$2 AND a.subcomponent_id=$3`,[classId,c.id,sub.id,studentId])).rows;else rows=await assessmentRows(studentId,classId,c.source_type,sub.source_filter||sub.name);
      const fixed=c.source_type==='exam'?sub.max_points:null;
      const r=summarize(rows,c.calculation_method,fixed);if(!r.complete||r.percent===null)return r;
      pct+=r.percent*Number(sub.weight_share)/componentWeight;if(r.earned!=null)earned+=Number(r.earned);if(r.max!=null)max+=Number(r.max);
    }
    return {percent:pct,complete:true,earned:max?earned:undefined,max:max||undefined};
  }
  const rows=c.source_type==='custom'?await assessmentRows(studentId,classId,'custom',{componentId:c.id}):await assessmentRows(studentId,classId,c.source_type);
  const fixed=['quiz','performance'].includes(c.source_type)?c.max_points:null;
  return summarize(rows,c.calculation_method,fixed);
}

async function computeDynamicClassGrade(studentId,classId){
  const scheme=await getDynamicScheme(classId);if(!scheme)return null;
  const totalWeight=scheme.components.reduce((s,c)=>s+Number(c.weight),0);if(Math.abs(totalWeight-100)>0.01)return {complete:false,status:'configuration_error',missing:[],components:{},finalGrade:null,message:`Grading scheme weights total ${totalWeight}%, not 100%.`};
  const components={},missing=[];let finalGrade=0;let firstConfigurationError=null;
  for(const c of scheme.components){
    const r=await componentResult(studentId,classId,c);
    components[c.component_key]={name:c.name,percent:r.percent,weight:Number(c.weight),available:r.complete&&r.percent!==null,adjusted:false,earned:r.earned,max:r.max,configuredMax:r.configuredMax};
    if(r.configurationError&&!firstConfigurationError)firstConfigurationError=`${c.name}: ${r.configurationError}`;
    if(Number(c.weight)>0&&(!r.complete||r.percent===null))missing.push(c.component_key);else if(Number(c.weight)>0)finalGrade+=r.percent*Number(c.weight)/100;
  }
  const status=(await pool.query(`SELECT status FROM grade_status WHERE student_id=$1 AND class_id=$2`,[studentId,classId])).rows[0];
  if(missing.length)return {complete:false,status:firstConfigurationError?'configuration_error':(status?status.status:'in_progress'),missing,components,finalGrade:null,message:firstConfigurationError||`Grade Incomplete — ${missing.map(k=>components[k]?.name||k).join(', ')} score/configuration pending.`,schemeId:scheme.id,schemeVersion:scheme.version};
  return {complete:true,status:status?status.status:'computed',missing:[],components,finalGrade:Math.round(finalGrade*100)/100,message:null,schemeId:scheme.id,schemeVersion:scheme.version};
}
module.exports={getDynamicScheme,computeDynamicClassGrade};
