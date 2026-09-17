// Quiz creation compatibility fix.
// The quizzes API uses `totalItems` as the authoritative maximum score field,
// while the shared Teacher assessment creator historically sent `maxScore`.
(() => {
  if (typeof Teacher === 'undefined' || typeof Teacher.createAssessment !== 'function') return;

  const originalCreateAssessment = Teacher.createAssessment.bind(Teacher);

  Teacher.createAssessment = async function(kind) {
    if (kind !== 'quizzes') return originalCreateAssessment(kind);

    const title = prompt('Quiz title:');
    if (title === null) return;
    if (!title.trim()) {
      Toast.show('Invalid Quiz', 'Quiz title is required.', 'error');
      return;
    }

    const entered = prompt('Maximum score / total items:', '10');
    if (entered === null) return;
    const totalItems = Number(entered);
    if (!Number.isFinite(totalItems) || totalItems <= 0) {
      Toast.show('Invalid Quiz', 'Maximum score / total items must be a positive number.', 'error');
      return;
    }

    try {
      await api('POST', '/assessments/quizzes', {
        classId: Teacher.state.classId,
        title: title.trim(),
        totalItems
      });
      Toast.show('Quiz Created', `Quiz created with a maximum score of ${totalItems}.`, 'success');

      // Refresh the authoritative Quiz tab immediately. The old compatibility
      // shim called renderAssessmentTab(), which is not part of the current
      // Teacher dashboard API, so the newly-created quiz was only visible
      // after a full browser refresh.
      if (typeof Teacher.renderAssessment === 'function') {
        await Teacher.renderAssessment('quizzes');
      }
    } catch {
      // api() already displays the server error.
    }
  };
})();
