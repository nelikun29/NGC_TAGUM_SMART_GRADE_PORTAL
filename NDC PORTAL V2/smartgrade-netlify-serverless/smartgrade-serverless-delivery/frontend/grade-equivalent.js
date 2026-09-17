// School Grade Equivalent + dashboard visual enhancement
// Loaded after app.js / teacher-enhancements.js.
// Existing server-side grade computation remains authoritative.
(() => {
  function equivalent(value) {
    const p = Number(value);
    if (!Number.isFinite(p)) return { percentage: null, rounded: null, numeric: '—', remarks: '—' };
    const whole = Math.max(0, Math.min(100, Math.round(p)));
    if (whole < 70) return { percentage: p, rounded: whole, numeric: '5.0', remarks: 'INC' };
    return {
      percentage: p,
      rounded: whole,
      numeric: (1 + (100 - whole) * 0.1).toFixed(1),
      remarks: whole >= 75 ? 'Passed' : 'INC'
    };
  }

  window.SchoolGradeEquivalent = { equivalent };

  // Scoped visual treatment: dark class-gallery surfaces make light cards distinct.
  const style = document.createElement('style');
  style.textContent = `
    .sg-class-gallery {
      background: linear-gradient(145deg,#0f172a 0%,#172554 52%,#111827 100%);
      border: 1px solid rgba(148,163,184,.22);
      border-radius: 24px;
      padding: 20px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.06),0 18px 45px rgba(15,23,42,.14);
    }
    .sg-class-gallery > .sg-gallery-heading h3,
    .sg-class-gallery > .sg-gallery-heading p { color:#fff !important; }
    .sg-class-gallery > .sg-gallery-heading p { opacity:.68; }
    .sg-student-class-card {
      background: linear-gradient(145deg,#ffffff 0%,#f8fafc 100%) !important;
      border:1px solid #cbd5e1 !important;
      border-left:6px solid #2563eb !important;
      box-shadow:0 12px 30px rgba(15,23,42,.12) !important;
      overflow:hidden;
    }
    .sg-student-pending-card {
      background:linear-gradient(145deg,#fffdf5 0%,#fff7d6 100%) !important;
      border:1px solid #fcd34d !important;
      border-left:6px solid #f59e0b !important;
      box-shadow:0 12px 30px rgba(120,53,15,.10) !important;
    }
    .sg-grade-equivalent-box {
      margin-top:.75rem;padding:.75rem 1rem;border-radius:.85rem;
      background:#eff6ff;border:1px solid #bfdbfe;
      display:flex;align-items:center;justify-content:space-between;gap:.75rem;
    }
    @media (max-width:640px){.sg-class-gallery{padding:14px;border-radius:18px;}}
  `;
  document.head.appendChild(style);

  // ---------- TEACHER: class gallery + grade-equivalent columns ----------
  if (typeof Teacher !== 'undefined') {
    const originalTeacherRender = Teacher.render?.bind(Teacher);
    if (originalTeacherRender) {
      Teacher.render = async function() {
        await originalTeacherRender();
        const section = document.getElementById('teacher-section');
        if (!section) return;
        const heading = [...section.querySelectorAll('h3')].find(h => h.textContent.trim().toLowerCase() === 'my classes');
        const headingRow = heading?.parentElement?.parentElement;
        const grid = headingRow?.nextElementSibling;
        const gallery = headingRow?.parentElement;
        if (gallery && grid && !gallery.classList.contains('sg-class-gallery')) {
          gallery.classList.add('sg-class-gallery');
          headingRow.classList.add('sg-gallery-heading');
        }
      };
    }

    const originalGradebook = Teacher.renderGradebook?.bind(Teacher);
    if (originalGradebook) {
      Teacher.renderGradebook = async function() {
        await originalGradebook();
        const table = document.querySelector('#teacher-tab-content #teacher-grade-table, #teacher-tab-content table.gradebook');
        if (!table || table.dataset.gradeEquivalentApplied === 'true') return;
        const headRow = table.querySelector('thead tr');
        if (!headRow) return;
        const headers = Array.from(headRow.children).map(th => (th.textContent || '').trim().toLowerCase());
        let gradeIndex = headers.findIndex(h => h === 'final' || h === 'final grade' || (h.includes('final') && h.includes('grade')));
        if (gradeIndex < 0) gradeIndex = headers.findIndex(h => h.includes('computed') || h.includes('percentage'));
        if (gradeIndex < 0) return;

        const finalHeader = headRow.children[gradeIndex];
        const thNumeric = document.createElement('th'); thNumeric.textContent = 'Numeric Grade';
        const thRemarks = document.createElement('th'); thRemarks.textContent = 'Remarks';
        finalHeader.after(thNumeric, thRemarks);

        table.querySelectorAll('tbody tr').forEach(tr => {
          const rawText = (tr.children[gradeIndex]?.textContent || '').replace('%','').trim();
          const result = equivalent(rawText);
          const tdNumeric = document.createElement('td');
          tdNumeric.className = 'font-black text-slate-700'; tdNumeric.textContent = result.numeric;
          if (result.rounded !== null) tdNumeric.title = `Equivalent based on rounded grade: ${result.rounded}%`;
          const tdRemarks = document.createElement('td');
          tdRemarks.innerHTML = result.remarks === 'Passed'
            ? '<span class="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">Passed</span>'
            : result.remarks === 'INC'
              ? '<span class="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">INC</span>' : '—';
          tr.children[gradeIndex]?.after(tdNumeric, tdRemarks);
        });
        table.dataset.gradeEquivalentApplied = 'true';
      };
    }
  }

  // ---------- STUDENT: stronger class cards + released grade equivalent ----------
  if (typeof Student !== 'undefined') {
    const originalPendingCard = Student.pendingCard?.bind(Student);
    if (originalPendingCard) Student.pendingCard = c => originalPendingCard(c).replace('glass-card rounded-2xl p-5 border-l-4 border-amber-400','glass-card sg-student-pending-card rounded-2xl p-5');

    const originalClassCard = Student.classCard?.bind(Student);
    if (originalClassCard) {
      Student.classCard = function(c, grade) {
        let html = originalClassCard(c, grade).replace('glass-card rounded-2xl p-5','glass-card sg-student-class-card rounded-2xl p-5');
        if (grade && grade.status === 'released' && grade.finalGrade !== null && grade.finalGrade !== undefined) {
          const eq = equivalent(grade.finalGrade);
          const badge = eq.remarks === 'Passed'
            ? '<span class="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">Passed</span>'
            : '<span class="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">INC</span>';
          const extra = `<div class="sg-grade-equivalent-box"><div><p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Grade Equivalent</p><p class="text-lg font-black text-blue-800">${eq.numeric}</p></div>${badge}</div>`;
          html = html.replace(/<\/div>\s*$/, `${extra}</div>`);
        }
        return html;
      };
    }
  }
})();