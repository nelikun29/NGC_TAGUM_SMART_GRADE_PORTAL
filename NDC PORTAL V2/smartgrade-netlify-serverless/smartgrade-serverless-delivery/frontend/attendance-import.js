// Google Form attendance import remains intentionally disabled.
// Load grading enhancements after all existing static application scripts have finished.
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
      // Re-render the selected teacher tab so the newly loaded controls are immediately visible.
      if (typeof Teacher !== 'undefined' && Teacher.state?.classId && Store?.user?.role === 'teacher') {
        Teacher.switchTab(Teacher.state.tab || 'gradebook');
      }
    } catch (err) {
      console.error('Unable to load grading enhancements:', err);
    }
  }, { once: true });
})();
