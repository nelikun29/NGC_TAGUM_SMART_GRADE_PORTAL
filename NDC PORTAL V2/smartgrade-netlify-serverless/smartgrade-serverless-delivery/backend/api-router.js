const express = require('express');
const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classes');
const attendanceRoutes = require('./routes/attendance');
const assessmentRoutes = require('./routes/assessments');
const gradeRoutes = require('./routes/grades');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const classManagementRoutes = require('./routes/class-management');
const gradingSchemeRoutes = require('./routes/grading-schemes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, message: 'Smart Grade API is running.' });
});

router.use('/auth', authRoutes);
router.use('/classes', classRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/assessments', assessmentRoutes);
router.use('/grades', gradeRoutes);
router.use('/reports', reportRoutes);
router.use('/admin', adminRoutes);
router.use('/class-management', classManagementRoutes);
router.use('/grading-schemes', gradingSchemeRoutes);

// Compatibility mounts for the teacher enhancement layer.  These reuse the
// same authenticated handlers; they do not duplicate business logic.
router.use('/', classManagementRoutes);

router.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? 'An unexpected error occurred.' : err.message;
  res.status(status).json({ error: message });
});

module.exports = router;
