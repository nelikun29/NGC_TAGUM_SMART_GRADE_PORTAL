const express=require('express');
const {pool}=require('../db');
const {authenticate,requireRole,requireClassOwnership}=require('../middleware/auth');
const {audit}=require('../utils/audit');
const router=express.Router();
router.use(authenticate);

const num=v=>v===null||v===undefined||v===''?null:Number(v);
async function schemeFor(classId){return (await pool.query('SELECT * FROM grading_schemes WHERE class_id=$1',[classId])).rows[0];}
async function configuredTotals(classId){
  const quiz=Number((await pool.query('SELECT COALESCE(SUM(total_items),0) n FROM quizzes WHERE class_id=$1',[classId])).rows[0].n);
  const performance=Number((await pool.query('SELECT COALESCE(SUM(max_score),0) n FROM performance_tasks WHERE class_id=$1',[classId])).rows[0].n);
  const exams=(await pool.query(`SELECT exam_type,COALESCE(SUM(max_score),0) n FROM examinations WHERE class_id=$1 GROUP BY exam_type`,[classId])).rows;
  return {quiz,performance,exams:Object.fromEntries(exams.map(r=>[String(r.exam_type||'').toLowerCase(),Number(r.n)]))};
}
router.get('/:classId',requireClassOwnership,async(req,res,next)=>{try{
  const scheme=await schemeFor(req.params.classId);if(!scheme)return res.status(404).json({error:'Grading scheme not found.'});
  const components=(await pool.query('SELECT id,name,component_key,source_type,max_points,weight FROM grading_components WHERE scheme_id=$1 AND is_active=TRUE ORDER BY sort_order,name',[scheme.id])).rows;
  for(const c of components)c.subcomponents=(await pool.query('SELECT id,name,subcomponent_key,source_filter,weight_share,max_points FROM grading_subcomponents WHERE component_id=$1 AND is_active=TRUE ORDER BY sort_order,name',[c.id])).rows;
  res.json({schemeId:scheme.id,state:scheme.state,components,configured:await configuredTotals(req.params.classId)});
}catch(e){next(e);}});

router.put('/:classId',requireRole('teacher','admin'),requireClassOwnership,async(req,res,next)=>{const client=await pool.connect();try{
  const scheme=(await client.query('SELECT * FROM grading_schemes WHERE class_id=$1 FOR UPDATE',[req.params.classId])).rows[0];if(!scheme)return res.status(404).json({error:'Grading scheme not found.'});
  if(scheme.state==='finalized')return res.status(409).json({error:'Finalized grading configuration is locked. Reopen it for revision first.'});
  const totals=await configuredTotals(req.params.classId);const items=Array.isArray(req.body.components)?req.body.components:[];
  await client.query('BEGIN');
  for(const item of items){
    const c=(await client.query('SELECT * FROM grading_components WHERE id=$1 AND scheme_id=$2',[item.id,scheme.id])).rows[0];if(!c)continue;
    if(['quiz','performance'].includes(c.source_type)){
      const denominator=num(item.maxPoints);if(denominator!==null&&(!Number.isFinite(denominator)||denominator<=0)){await client.query('ROLLBACK');return res.status(400).json({error:`${c.name} Overall Total Score must be greater than 0.`});}
      const used=c.source_type==='quiz'?totals.quiz:totals.performance;if(denominator!==null&&used>denominator){await client.query('ROLLBACK');return res.status(400).json({error:`${c.name}: configured assessments total ${used} points, which exceeds the proposed overall total of ${denominator}.`});}
      await client.query('UPDATE grading_components SET max_points=$1,calculation_method=$2,updated_at=now() WHERE id=$3',[denominator,denominator===null?'average_percentage':'points_total',c.id]);
    }
    if(c.source_type==='exam')for(const sub of item.subcomponents||[]){
      const dbSub=(await client.query('SELECT * FROM grading_subcomponents WHERE id=$1 AND component_id=$2',[sub.id,c.id])).rows[0];if(!dbSub)continue;const denominator=num(sub.maxPoints);if(denominator!==null&&(!Number.isFinite(denominator)||denominator<=0)){await client.query('ROLLBACK');return res.status(400).json({error:`${dbSub.name} Overall Total Score must be greater than 0.`});}
      const key=String(dbSub.source_filter||dbSub.name||'').toLowerCase(),used=totals.exams[key]||0;if(denominator!==null&&used>denominator){await client.query('ROLLBACK');return res.status(400).json({error:`${dbSub.name}: configured exams total ${used} points, which exceeds the proposed overall total of ${denominator}.`});}
      await client.query('UPDATE grading_subcomponents SET max_points=$1,updated_at=now() WHERE id=$2',[denominator,dbSub.id]);
    }
  }
  await client.query('COMMIT');try{await audit(req,{action:'grading_denominator_update',recordType:'grading_scheme',recordId:scheme.id,newValue:{classId:req.params.classId}});}catch(e){console.error('Audit logging failed:',e);}
  res.json({message:'Overall total scores saved.'});
}catch(e){try{await client.query('ROLLBACK');}catch{}next(e);}finally{client.release();}});
module.exports=router;
