const { pool } = require('../db');
const { computeDynamicClassGrade } = require('./dynamic-grading');

async function getWeights(classId) {
  const { rows } = await pool.query(`SELECT * FROM grading_weights WHERE class_id = $1`, [classId]);
  if (!rows[0]) return { attendance_weight: 10, quiz_weight: 20, performance_weight: 30, exam_weight: 40 };
  return rows[0];
}

function validateWeights({ attendance_weight, quiz_weight, performance_weight, exam_weight }) {
  const total = Number(attendance_weight)+Number(quiz_weight)+Number(performance_weight)+Number(exam_weight);
  if (Math.abs(total-100)>0.01) return {valid:false,message:'Assessment weights must total exactly 100%.'};
  if ([attendance_weight,quiz_weight,performance_weight,exam_weight].some(v=>Number(v)<0)) return {valid:false,message:'Weights cannot be negative.'};
  return {valid:true};
}

async function attendanceRaw(studentId,classId){
  const {rows}=await pool.query(`SELECT ar.status FROM attendance_records ar JOIN attendance_sessions s ON ar.session_id=s.id WHERE s.class_id=$1 AND ar.student_id=$2`,[classId,studentId]);
  const counted=rows.filter(r=>r.status!=='excused'); if(!counted.length)return null;
  const points=counted.reduce((sum,r)=>sum+(r.status==='present'?1:r.status==='late'?0.75:0),0); return {points,max:counted.length};
}
async function attendancePercent(studentId,classId){const raw=await attendanceRaw(studentId,classId);return raw?(raw.points/raw.max)*100:null;}

async function componentRaw(studentId,classId,table,parentTable,parentFk,maxField){
  const {rows}=await pool.query(`SELECT sc.raw_score,p.${maxField} AS max_score,sc.verification_status,sc.is_locked FROM ${table} sc JOIN ${parentTable} p ON sc.${parentFk}=p.id WHERE p.class_id=$1 AND sc.student_id=$2`,[classId,studentId]);
  const usable=rows.filter(r=>r.verification_status!=='pending'&&r.verification_status!=='rejected'); const withScores=usable.filter(r=>r.raw_score!==null&&r.raw_score!==undefined);
  return {totalRecords:rows.length,usableCount:usable.length,scoredCount:withScores.length,rawSum:withScores.reduce((s,r)=>s+Number(r.raw_score),0),maxSum:withScores.reduce((s,r)=>s+Number(r.max_score),0),items:withScores};
}
async function componentPercent(studentId,classId,table,parentTable,parentFk,maxField){
  const raw=await componentRaw(studentId,classId,table,parentTable,parentFk,maxField);
  if(raw.totalRecords===0)return {percent:null,complete:true,pendingCount:0};
  if(raw.usableCount===0)return {percent:null,complete:false,pendingCount:raw.totalRecords};
  if(raw.scoredCount<raw.usableCount)return {percent:null,complete:false,pendingCount:raw.usableCount-raw.scoredCount};
  if(raw.scoredCount===0)return {percent:null,complete:false,pendingCount:raw.usableCount};
  return {percent:raw.items.reduce((s,r)=>s+(Number(r.raw_score)/Number(r.max_score))*100,0)/raw.items.length,complete:true,pendingCount:0};
}
async function getAdjustments(studentId,classId){const {rows}=await pool.query(`SELECT * FROM grade_adjustments WHERE student_id=$1 AND class_id=$2`,[studentId,classId]);const out={};for(const r of rows)out[r.component]=r;return out;}

async function buildAdjustmentContext(studentId,classId,component){
  if(component==='attendance'){const raw=await attendanceRaw(studentId,classId);if(!raw)return {error:'This student has no recorded attendance sessions yet — nothing to adjust.'};return {recordedTotal:raw.points,max:raw.max,label:'sessions'};}
  const map={quiz:['quiz_scores','quizzes','quiz_id','total_items'],performance:['performance_scores','performance_tasks','task_id','max_score'],exam:['exam_scores','examinations','exam_id','max_score']};
  if(!map[component])return {error:'Invalid component.'}; const raw=await componentRaw(studentId,classId,...map[component]); if(!raw.scoredCount)return {error:'This student has no recorded scores for this component yet — nothing to adjust.'}; return {recordedTotal:Math.round(raw.rawSum*100)/100,max:raw.maxSum,label:'points'};
}
async function computeAdjustmentDelta(studentId,classId,component,newTotal){const ctx=await buildAdjustmentContext(studentId,classId,component);if(ctx.error)return {valid:false,message:ctx.error};if(typeof newTotal!=='number'||!Number.isFinite(newTotal))return {valid:false,message:'New total must be a number.'};if(newTotal<0)return {valid:false,message:`${component[0].toUpperCase()+component.slice(1)} total cannot be negative.`};if(newTotal>ctx.max)return {valid:false,message:`${component[0].toUpperCase()+component.slice(1)} total cannot exceed ${ctx.max} ${ctx.label}.`};return {valid:true,deltaPercent:((newTotal-ctx.recordedTotal)/ctx.max)*100,recordedTotal:ctx.recordedTotal,max:ctx.max,newTotal};}

async function computeLegacyClassGrade(studentId,classId){
  const weights=await getWeights(classId);
  const [attendancePct,quiz,pt,exam,statusRow,adjustments]=await Promise.all([attendancePercent(studentId,classId),componentPercent(studentId,classId,'quiz_scores','quizzes','quiz_id','total_items'),componentPercent(studentId,classId,'performance_scores','performance_tasks','task_id','max_score'),componentPercent(studentId,classId,'exam_scores','examinations','exam_id','max_score'),pool.query(`SELECT status FROM grade_status WHERE student_id=$1 AND class_id=$2`,[studentId,classId]),getAdjustments(studentId,classId)]);
  function adj(name,percent){const a=adjustments[name];if(!a||percent===null)return {percent,adjusted:false};return {percent:Math.max(0,Math.min(100,percent+Number(a.adjustment_points))),adjusted:true};}
  const aa=adj('attendance',attendancePct),qa=adj('quiz',quiz.percent),pa=adj('performance',pt.percent),ea=adj('exam',exam.percent);
  const components={attendance:{percent:aa.percent,weight:Number(weights.attendance_weight),available:aa.percent!==null,adjusted:aa.adjusted},quiz:{percent:qa.percent,weight:Number(weights.quiz_weight),available:qa.percent!==null&&quiz.complete,adjusted:qa.adjusted},performance:{percent:pa.percent,weight:Number(weights.performance_weight),available:pa.percent!==null&&pt.complete,adjusted:pa.adjusted},exam:{percent:ea.percent,weight:Number(weights.exam_weight),available:ea.percent!==null&&exam.complete,adjusted:ea.adjusted}};
  const missing=Object.entries(components).filter(([,c])=>c.weight>0&&!c.available).map(([n])=>n);const status=statusRow.rows[0];
  if(missing.length)return {complete:false,status:status?status.status:'in_progress',missing,components,finalGrade:null,message:`Grade Incomplete — ${missing.map(m=>m[0].toUpperCase()+m.slice(1)).join(', ')} score pending.`};
  let finalGrade=0;for(const c of Object.values(components))if(c.weight>0)finalGrade+=(c.percent*c.weight)/100;
  return {complete:true,status:status?status.status:'computed',missing:[],components,finalGrade:Math.round(finalGrade*100)/100,message:null};
}

async function computeClassGrade(studentId,classId){
  const dynamic=await computeDynamicClassGrade(studentId,classId);
  if(dynamic)return dynamic;
  return computeLegacyClassGrade(studentId,classId);
}

module.exports={getWeights,validateWeights,computeClassGrade,buildAdjustmentContext,computeAdjustmentDelta};
