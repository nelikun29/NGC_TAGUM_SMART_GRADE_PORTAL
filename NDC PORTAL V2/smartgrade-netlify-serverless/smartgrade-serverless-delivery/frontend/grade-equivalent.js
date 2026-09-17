// School Grade Equivalent enhancement
// Preserves the portal's existing percentage computation and derives only
// Numeric Grade + Remarks from the final percentage.
(() => {
  if (typeof Teacher === 'undefined') return;

  function equivalent(value) {
    const p = Number(value);
    if (!Number.isFinite(p)) return { numeric: '—', remarks: '—' };
    // Official scale supplied by the school. Round the displayed/computed
    // percentage to the nearest whole percentage point before lookup.
    const whole = Math.round(p);
    if (whole < 70) return { numeric: '5.0', remarks: 'INC' };
    if (whole > 100) return { numeric: '1.0', remarks: 'Passed' };
    const numeric = (1 + (100 - whole) * 0.1).toFixed(1);
    return { numeric, remarks: whole >= 75 ? 'Passed' : 'INC' };
  }

  window.SchoolGradeEquivalent = { equivalent };

  function gradeValue(row) {
    // Support the grade field names used across portal revisions without
    // altering the underlying grade calculation.
    const keys = ['finalGrade', 'final_grade', 'computedGrade', 'computed_grade', 'overallGrade', 'overall_grade', 'grade', 'percentage'];
    for (const k of keys) {
      if (row && row[k] !== null && row[k] !== undefined && row[k] !== '' && Number.isFinite(Number(row[k]))) return Number(row[k]);
    }
    return null;
  }

  const original = Teacher.renderGradebook?.bind(Teacher);
  if (!original) return;

  Teacher.renderGradebook = async function() {
    await original();
    const box = document.getElementById('teacher-tab-content');
    const table = box?.querySelector('table.gradebook, table');
    if (!table || table.dataset.gradeEquivalentApplied === 'true') return;
    table.dataset.gradeEquivalentApplied = 'true';

    // Use rendered percentage/final-grade text so this remains display-only.
    const headRow = table.querySelector('thead tr');
    if (!headRow) return;
    const headers = Array.from(headRow.children).map(th => (th.textContent || '').trim().toLowerCase());
    let gradeIndex = headers.findIndex(h => h.includes('final') && h.includes('grade'));
    if (gradeIndex < 0) gradeIndex = headers.findIndex(h => h.includes('computed') || h.includes('percentage'));
    if (gradeIndex < 0) return;

    const thNumeric = document.createElement('th'); thNumeric.textContent = 'Numeric Grade';
    const thRemarks = document.createElement('th'); thRemarks.textContent = 'Remarks';
    headRow.appendChild(thNumeric); headRow.appendChild(thRemarks);

    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = Array.from(tr.children);
      const raw = (cells[gradeIndex]?.textContent || '').replace('%','').trim();
      const result = equivalent(raw);
      const tdN = document.createElement('td'); tdN.className = 'font-black text-slate-700'; tdN.textContent = result.numeric;
      const tdR = document.createElement('td');
      tdR.innerHTML = result.remarks === 'Passed'
        ? '<span class="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">Passed</span>'
        : result.remarks === 'INC'
          ? '<span class="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">INC</span>'
          : '—';
      tr.appendChild(tdN); tr.appendChild(tdR);
    });
  };
})();