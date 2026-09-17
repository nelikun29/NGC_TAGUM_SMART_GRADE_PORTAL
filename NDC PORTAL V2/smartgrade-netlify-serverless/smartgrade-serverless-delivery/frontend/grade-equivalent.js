// School Grade Equivalent enhancement
// Existing grade computation remains authoritative. This file derives only
// the school's Numeric Grade and Remarks from the computed percentage.
(() => {
  if (typeof Teacher === 'undefined') return;

  function equivalent(value) {
    const p = Number(value);
    if (!Number.isFinite(p)) return { percentage: null, rounded: null, numeric: '—', remarks: '—' };

    // School rule: round the computed percentage to the nearest whole number
    // before applying the equivalency table (e.g. 89.60 -> 90 -> 2.0).
    const whole = Math.max(0, Math.min(100, Math.round(p)));

    if (whole < 70) {
      return { percentage: p, rounded: whole, numeric: '5.0', remarks: 'INC' };
    }

    const numeric = (1 + (100 - whole) * 0.1).toFixed(1);
    return {
      percentage: p,
      rounded: whole,
      numeric,
      remarks: whole >= 75 ? 'Passed' : 'INC'
    };
  }

  window.SchoolGradeEquivalent = { equivalent };

  const original = Teacher.renderGradebook?.bind(Teacher);
  if (!original) return;

  Teacher.renderGradebook = async function() {
    await original();

    const table = document.querySelector('#teacher-tab-content #teacher-grade-table, #teacher-tab-content table.gradebook');
    if (!table || table.dataset.gradeEquivalentApplied === 'true') return;

    const headRow = table.querySelector('thead tr');
    if (!headRow) return;

    const headers = Array.from(headRow.children).map(th => (th.textContent || '').trim().toLowerCase());
    let gradeIndex = headers.findIndex(h => h === 'final' || h === 'final grade' || (h.includes('final') && h.includes('grade')));
    if (gradeIndex < 0) gradeIndex = headers.findIndex(h => h.includes('computed') || h.includes('percentage'));
    if (gradeIndex < 0) return;

    // Insert immediately after Final, before Status/Actions.
    const finalHeader = headRow.children[gradeIndex];
    const thNumeric = document.createElement('th');
    thNumeric.textContent = 'Numeric Grade';
    const thRemarks = document.createElement('th');
    thRemarks.textContent = 'Remarks';
    finalHeader.after(thNumeric, thRemarks);

    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = Array.from(tr.children);
      const rawText = (cells[gradeIndex]?.textContent || '').replace('%', '').trim();
      const result = equivalent(rawText);

      const tdNumeric = document.createElement('td');
      tdNumeric.className = 'font-black text-slate-700';
      tdNumeric.textContent = result.numeric;
      if (result.rounded !== null) tdNumeric.title = `Equivalent based on rounded grade: ${result.rounded}%`;

      const tdRemarks = document.createElement('td');
      if (result.remarks === 'Passed') {
        tdRemarks.innerHTML = '<span class="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">Passed</span>';
      } else if (result.remarks === 'INC') {
        tdRemarks.innerHTML = '<span class="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">INC</span>';
      } else {
        tdRemarks.textContent = '—';
      }

      const finalCell = tr.children[gradeIndex];
      if (finalCell) finalCell.after(tdNumeric, tdRemarks);
    });

    table.dataset.gradeEquivalentApplied = 'true';
  };
})();