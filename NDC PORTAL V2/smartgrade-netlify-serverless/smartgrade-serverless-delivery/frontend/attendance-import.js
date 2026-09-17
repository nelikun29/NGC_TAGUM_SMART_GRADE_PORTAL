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
      await loadScript('./admin-role-correction.js');
      await loadScript('./quiz-create-fix.js');
      await loadScript('./reference-dashboard-theme.js');
      // Re-render the active role tab so newly loaded controls are immediately visible.
      if (typeof Teacher !== 'undefined' && Teacher.state?.classId && Store?.user?.role === 'teacher') {
        Teacher.switchTab(Teacher.state.tab || 'gradebook');
      }
      if (typeof Admin !== 'undefined' && Store?.user?.role === 'admin' && Admin.tab === 'users') {
        Admin.renderUsers();
      }
    } catch (err) {
      console.error('Unable to load portal enhancements:', err);
    }
  }, { once: true });
})();
