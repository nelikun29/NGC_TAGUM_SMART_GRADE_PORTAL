// Google Form attendance import remains intentionally disabled.
// Load role-specific enhancements after all existing static application scripts have finished.
(() => {
  const ASSET_VERSION = '20260920-account-integrity-v2';
  async function loadScript(src) {
    const cleanSrc = String(src).split('?')[0];
    if ([...document.scripts].some(s => String(s.getAttribute('src') || '').split('?')[0] === cleanSrc)) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = cleanSrc + '?v=' + encodeURIComponent(ASSET_VERSION);
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }
  window.addEventListener('load', async () => {
    const enhancements = [
      './teacher-grading-controls.js',
      './dynamic-grading-ui.js',
      // Assessment denominators are configured exclusively in the Weights editor.
      './admin-role-correction.js',
      './quiz-create-fix.js',
      './reference-dashboard-theme.js',
      './student-class-card-enhancement.js',
      './teacher-class-card-enhancement.js',
      './gradebook-raw-data.js',
      './gradebook-finalize-all.js',
      './manual-grade-adjustments.js',
      './teacher-student-name-format.js',
      './unfinalize-workflow.js',
      // Keep the authoritative Admin Users renderer last.
      './admin-users.js'
    ];
    for (const src of enhancements) {
      try { await loadScript(src); }
      catch (err) { console.error(`Unable to load portal enhancement ${src}:`, err); }
    }
    try {
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
      console.error('Unable to refresh the active portal view after enhancements loaded:', err);
    }
  }, { once: true });
})();
