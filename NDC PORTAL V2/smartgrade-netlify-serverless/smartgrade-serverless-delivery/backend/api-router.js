require('dotenv').config();
const express=require('express');
const helmet=require('helmet');
const cors=require('cors');
const rateLimit=require('express-rate-limit');
const authRoutes=require('./routes/auth');
const classRoutes=require('./routes/classes');
const attendanceRoutes=require('./routes/attendance');
const assessmentRoutes=require('./routes/assessments');
const assessmentGuard=require('./middleware/assessment-guard');
const assessmentManagementRoutes=require('./routes/assessment-management');
const customAssessmentRoutes=require('./routes/custom-assessments');
const gradeRoutes=require('./routes/grades');
const gradeExportRoutes=require('./routes/grade-export');
const adminRoutes=require('./routes/admin');
const unfinalizeRequestRoutes=require('./routes/unfinalize-requests');
const reportRoutes=require('./routes/reports');
const classManagementRoutes=require('./routes/class-management');
const gradingSchemeRoutes=require('./routes/grading-schemes');
const gradingDenominatorRoutes=require('./routes/grading-denominators');
const router=express.Router();
router.use(helmet());
router.use(cors({origin:process.env.CORS_ORIGIN?process.env.CORS_ORIGIN.split(','):'*'}));
router.use(express.json({limit:'1mb'}));
// Netlify Functions can invoke Express without populating req.ip. Use the
// platform-provided forwarding headers directly and avoid express-rate-limit's
// req.ip validation path while retaining per-client throttling.
router.use(rateLimit({
  windowMs:60000,
  max:300,
  validate:{ip:false},
  keyGenerator:req=>{
    const forwarded=req.headers['x-forwarded-for'];
    if(typeof forwarded==='string'&&forwarded.trim())return forwarded.split(',')[0].trim();
    const nfIp=req.headers['x-nf-client-connection-ip'];
    if(typeof nfIp==='string'&&nfIp.trim())return nfIp.trim();
    return 'netlify-client';
  }
}));
router.use('/auth',authRoutes);router.use('/classes',classRoutes);router.use('/attendance',attendanceRoutes);router.use('/assessments',assessmentGuard,assessmentRoutes);router.use('/assessments',assessmentManagementRoutes);router.use('/custom-assessments',customAssessmentRoutes);router.use('/grades',gradeRoutes);router.use('/grade-export',gradeExportRoutes);router.use('/admin/unfinalize-requests',unfinalizeRequestRoutes);router.use('/admin',adminRoutes);router.use('/reports',reportRoutes);router.use('/grading-schemes',gradingSchemeRoutes);router.use('/grading-denominators',gradingDenominatorRoutes);router.use('/',classManagementRoutes);
router.get('/health',(req,res)=>res.json({status:'ok',time:new Date().toISOString()}));router.get('/config',(req,res)=>res.json({institutionName:process.env.INSTITUTION_NAME||'Smart Grade & Attendance Portal'}));router.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'An unexpected server error occurred.'});});module.exports=router;
