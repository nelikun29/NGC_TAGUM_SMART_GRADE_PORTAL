// Teacher Gradebook raw-score display enhancement.
// Uses the server-computed gradebook payload as the single source of truth.
// Presentation only: does not recalculate or mutate grades.
(() => {
  if (typeof Teacher === 'undefined' || typeof api !== 'function') return;

  const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100);
  };
  const pct = n => Number.isFinite(Number(n)) ? `${(Math.round(Number(n) * 100) / 100).toFixed(2)}%` : '—';
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

  const css = document.createElement('style');
  css.textContent = `
    .sg-raw-grade{display:block;margin-top:3px;font-size:10px;font-weight:800;line-height:1.2;color:#64748b;white-space:nowrap}
    .sg-raw-grade strong{color:#334155;font-weight:900}
    .sg-raw-grade.sg-pending{color:#b45309}
    #teacher-tab-content thead th .sg-header-hint{display:block;margin-top:2px;font-size:8px;font-weight:700;letter-spacing:0;text-transform:none;opacity:.72}
  `;
  document.head.appendChild(css);

  function componentForHeader(header, row) {
    const h = norm(header);
    const entries = Object.entries(row?.components || {});
    if (!entries.length) return null;
    const aliases = {
      attendance:['attendance'],
      quiz:['quiz','quizzes'],
      performance:['performance','performance task','performance tasks'],
      exam:['exam','examination','exams']
    };
    for (const [key, words] of Object.entries(aliases)) {
      if (words.some(w => h === w || h.includes(w))) {
        return row.components[key] || entries.find(([,c]) => norm(c?.name).includes(words[0]))?.[1] || null;
      }
    }
    return entries.find(([,c]) => {
      const name = norm(c?.name);
      return name && (h === name || h.includes(name) || name.includes(h));
    })?.[1] || null;
  }

  function findGradeTable() {
    const host = document.getElementById('teacher-tab-content');
    if (!host) return null;
    const tables = [...host.querySelectorAll('table')];
    return tables.find(t => {
      const heads = [...t.querySelectorAll('thead th')].map(x => norm(x.textContent));
      return heads.some(h => h.includes('attendance') || h.includes('quiz') || h.includes('performance') || h.includes('exam'));
    }) || null;
  }

  function matchRow(tr, data) {
    const text = norm(tr.textContent);
    return data.find(r => {
      const no = norm(r.studentNumber);
      const name = norm(r.studentName);
      return (no && text.includes(no)) || (name && text.includes(name));
    });
  }

  async function applyRawData() {
    if (Teacher.state?.tab !== 'gradebook' || !Teacher.state?.classId) return;
    const table = findGradeTable();
    if (!table) return;
    let data;
    try { data = await api('GET', `/grades/${Teacher.state.classId}/gradebook`); }
    catch { return; }
    if (!Array.isArray(data)) return;

    const headers = [...table.querySelectorAll('thead th')];
    headers.forEach(th => {
      const probe = data.find(r => componentForHeader(th.textContent, r));
      if (probe && !th.querySelector('.sg-header-hint')) th.insertAdjacentHTML('beforeend','<span class="sg-header-hint">Raw / Total · Percentage</span>');
    });

    table.querySelectorAll('tbody tr').forEach(tr => {
      const row = matchRow(tr, data);
      if (!row) return;
      [...tr.children].forEach((td, i) => {
        const th = headers[i]; if (!th) return;
        const c = componentForHeader(th.childNodes[0]?.textContent || th.textContent, row);
        if (!c || td.querySelector('.sg-raw-grade')) return;
        const rawAvailable = c.earned !== null && c.earned !== undefined && c.max !== null && c.max !== undefined;
        const raw = rawAvailable ? `<strong>${escHtml(fmt(c.earned))} / ${escHtml(fmt(c.max))}</strong> · ${escHtml(pct(c.percent))}` : (c.available ? escHtml(pct(c.percent)) : 'Score pending');
        td.insertAdjacentHTML('beforeend', `<span class="sg-raw-grade ${c.available ? '' : 'sg-pending'}">${raw}</span>`);
      });
    });
    table.dataset.rawGradeDataApplied = 'true';
  }

  const original = Teacher.renderGradebook?.bind(Teacher);
  if (original) {
    Teacher.renderGradebook = async function() {
      await original();
      await applyRawData();
    };
  }

  // Covers cases where another enhancement renders/re-renders the gradebook after this script loads.
  const observer = new MutationObserver(() => {
    if (Teacher.state?.tab === 'gradebook') setTimeout(applyRawData, 0);
  });
  const host = document.getElementById('teacher-tab-content');
  if (host) observer.observe(host,{childList:true,subtree:true});
  if (Teacher.state?.tab === 'gradebook') setTimeout(applyRawData, 0);
})();
