// Google Form attendance import remains intentionally disabled.
// Load role-specific enhancements after all existing static application scripts have finished.
(() => {
  async function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }
  window.addEventListener('load', async () => {
    try {
      await loadScript('./teacher-grading-controls.js');
      await loadScript('./dynamic-grading-ui.js');
      await loadScript('./grading-denominators-ui.js');
      await loadScript('./admin-role-correction.js');
      await loadScript('./quiz-create-fix.js');
      await loadScript('./reference-dashboard-theme.js');
      await loadScript('./student-class-card-enhancement.js');
      await loadScript('./teacher-class-card-enhancement.js');
      await loadScript('./gradebook-raw-data.js');
      await loadScript('./gradebook-finalize-all.js');
      await loadScript('./manual-grade-adjustments.js');
      await loadScript('./teacher-student-name-format.js');
      await loadScript('./unfinalize-workflow.js');
      // Re-render the active role tab so newly loaded controls are immediately visible.
      if (typeof Teacher !== 'undefined' && Store?.user?.role === 'teacher') {
        await Teacher.render();
        if (Teacher.state?.classId) Teacher.switchTab(Teacher.state.tab || 'gradebook');
      }
      if (typeof Student !== 'undefined' && Store?.user?.role === 'student') {
        await Student.render();
      }
      if (typeof Admin !== 'undefined' && Store?.user?.role === 'admin') {
        await Admin.render();
      }
    } catch (err) {
      console.error('Unable to load portal enhancements:', err);
    }
  }, { once: true });
})();
