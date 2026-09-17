// Google Form Attendance Importer
// Preview-first CSV import. No database writes occur until teacher confirms.
// Timestamp is reference-only; teacher supplies the official attendance date.
(() => {
  if (typeof Teacher === 'undefined') return;

  const normalize = value => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  const tokens = value => normalize(value).split(' ').filter(Boolean);
  const initials = new Set('a b c d e f g h i j k l m n o p q r s t u v w x y z'.split(' '));
  const significant = value => tokens(value).filter(x => x.length > 1 || !initials.has(x));

  function csvRows(text) {
    const out = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i + 1];
      if (ch === '"' && quoted && next === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
      else if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cell); if (row.some(v => String(v).trim())) out.push(row); row = []; cell = '';
      } else cell += ch;
    }
    row.push(cell); if (row.some(v => String(v).trim())) out.push(row);
    return out;
  }

  function scoreName(input, student) {
    const q = significant(input);
    const full = significant(`${student.first_name || ''} ${student.middle_name || ''} ${student.last_name || ''}`);
    const firstLast = significant(`${student.first_name || ''} ${student.last_name || ''}`);
    const last = significant(student.last_name || '');
    if (!q.length || !last.length) return 0;
    const qs = [...q].sort().join('|');
    if (qs === [...full].sort().join('|') || qs === [...firstLast].sort().join('|')) return 100;
    // Unique surname-only matching is resolved separately by requiring a single top candidate.
    if (q.join('|') === last.join('|')) return 90;
    const overlap = q.filter(t => full.includes(t)).length;
    if (overlap === q.length && overlap >= 2) return 80 + Math.min(9, overlap);
    if (overlap >= 2) return Math.round((overlap / Math.max(q.length, full.length)) * 70);
    return 0;
  }

  function matchName(name, roster) {
    const ranked = roster.map(s => ({ s, score: scoreName(name, s) })).filter(x => x.score >= 70).sort((a,b) => b.score - a.score);
    if (!ranked.length) return { status: 'unmatched', student: null };
    const top = ranked[0];
    const tied = ranked.filter(x => x.score === top.score);
    if (tied.length > 1) return { status: 'review', student: null, candidates: tied.map(x => x.s) };
    return { status: top.score >= 90 ? 'matched' : 'review', student: top.s, candidates: ranked.slice(0,4).map(x => x.s) };
  }

  Teacher.openAttendanceImport = async function() {
    const cid = Teacher.state.classId;
    if (!cid) return;
    const roster = await api('GET', `/classes/${cid}/roster`).catch(() => []);
    Teacher._attendanceImportRoster = Array.isArray(roster) ? roster : [];
    const box = document.getElementById('teacher-tab-content');
    box.innerHTML = `
      <div class="space-y-4">
        <button type="button" onclick="Teacher.renderAttendance()" class="text-sm font-bold text-eduBlue-600"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Attendance</button>
        <div class="glass-card rounded-2xl p-5">
          <h4 class="font-black text-slate-800"><i class="fa-solid fa-file-import mr-2 text-emerald-600"></i>Import Google Form Attendance</h4>
          <p class="mt-1 text-xs text-slate-500">Export the Google Form response Sheet as CSV. Timestamp is for reference only; you choose the official attendance date.</p>
          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <label class="text-xs font-bold text-slate-600">Official Attendance Date<input id="att-import-date" type="date" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" required></label>
            <label class="text-xs font-bold text-slate-600">Attendance Code / Event<input id="att-import-code" placeholder="e.g. ORIENTATION" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"></label>
          </div>
          <label class="mt-4 block text-xs font-bold text-slate-600">Google Form CSV<input id="att-import-file" type="file" accept=".csv,text/csv" class="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"></label>
          <label class="mt-4 flex items-center gap-2 text-xs text-slate-600"><input id="att-import-absent" type="checkbox"> Mark enrolled students with no accepted response as Absent (OFF by default)</label>
          <button type="button" onclick="Teacher.previewAttendanceImport()" class="mt-5 rounded-xl bg-eduBlue-600 px-4 py-2.5 text-sm font-black text-white"><i class="fa-solid fa-magnifying-glass mr-1"></i> Preview Import</button>
        </div>
        <div id="att-import-preview"></div>
      </div>`;
  };

  Teacher.previewAttendanceImport = async function() {
    const file = document.getElementById('att-import-file')?.files?.[0];
    const date = document.getElementById('att-import-date')?.value;
    const wantedCode = normalize(document.getElementById('att-import-code')?.value);
    if (!file || !date) return Toast.show('Import Required', 'Choose the official attendance date and a CSV file.', 'error');
    const matrix = csvRows(await file.text());
    if (matrix.length < 2) return Toast.show('Empty File', 'No response rows were found.', 'error');
    const headers = matrix[0].map(normalize);
    const nameIndex = headers.findIndex(h => h.includes('complete name') || h === 'name' || h.includes('student name'));
    const codeIndex = headers.findIndex(h => h.includes('attendance code'));
    const timeIndex = headers.findIndex(h => h.includes('timestamp'));
    if (nameIndex < 0) return Toast.show('Name Column Missing', 'Could not find the Complete Name column.', 'error');

    const seenRaw = new Set();
    const seenStudent = new Set();
    const results = [];
    matrix.slice(1).forEach((r, idx) => {
      const rawName = String(r[nameIndex] || '').trim();
      const code = codeIndex >= 0 ? String(r[codeIndex] || '').trim() : '';
      if (!rawName || (wantedCode && normalize(code) !== wantedCode)) return;
      const rawKey = `${normalize(rawName)}|${normalize(code)}`;
      const m = matchName(rawName, Teacher._attendanceImportRoster || []);
      let status = m.status;
      if (seenRaw.has(rawKey)) status = 'duplicate';
      if (m.student && seenStudent.has(m.student.id)) status = 'duplicate';
      seenRaw.add(rawKey); if (m.student && status !== 'duplicate') seenStudent.add(m.student.id);
      results.push({ row: idx + 2, rawName, code, timestamp: timeIndex >= 0 ? r[timeIndex] : '', status, student: m.student, candidates: m.candidates || [] });
    });
    Teacher._attendanceImport = { date, code: document.getElementById('att-import-code')?.value?.trim() || 'Imported Attendance', rows: results };
    Teacher.renderAttendanceImportPreview();
  };

  Teacher.renderAttendanceImportPreview = function() {
    const box = document.getElementById('att-import-preview'); const data = Teacher._attendanceImport; if (!box || !data) return;
    const accepted = data.rows.filter(r => r.status === 'matched' && r.student);
    const review = data.rows.filter(r => r.status === 'review');
    const unmatched = data.rows.filter(r => r.status === 'unmatched');
    const duplicates = data.rows.filter(r => r.status === 'duplicate');
    box.innerHTML = `<div class="glass-card rounded-2xl p-5">
      <div class="flex flex-wrap gap-2 text-xs font-bold"><span class="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">${accepted.length} Matched</span><span class="rounded-full bg-amber-100 px-3 py-1 text-amber-700">${review.length} Review</span><span class="rounded-full bg-red-100 px-3 py-1 text-red-700">${unmatched.length} Unmatched</span><span class="rounded-full bg-slate-100 px-3 py-1 text-slate-600">${duplicates.length} Duplicate</span></div>
      <div class="mt-4 overflow-x-auto"><table class="gradebook w-full text-left text-xs"><thead><tr><th>Form Name</th><th>Timestamp</th><th>Portal Student</th><th>Status</th></tr></thead><tbody>${data.rows.map((r,i) => `<tr class="border-t"><td>${esc(r.rawName)}</td><td>${esc(r.timestamp || '—')}</td><td>${r.status === 'review' || r.status === 'unmatched' ? `<select onchange="Teacher.resolveAttendanceImport(${i},this.value)" class="rounded-lg border px-2 py-1"><option value="">Select student…</option>${(Teacher._attendanceImportRoster || []).map(s => `<option value="${esc(s.id)}">${esc(s.last_name)}, ${esc(s.first_name)}</option>`).join('')}</select>` : esc(r.student ? `${r.student.last_name}, ${r.student.first_name}` : '—')}</td><td>${r.status === 'matched' ? '✅ Matched' : r.status === 'duplicate' ? '⚪ Duplicate ignored' : r.status === 'review' ? '⚠️ Review' : '❌ Unmatched'}</td></tr>`).join('')}</tbody></table></div>
      <p class="mt-4 text-xs text-slate-500">Only rows marked Matched will be imported. Duplicate responses are counted once. Review/Unmatched rows require manual student selection.</p>
      <button type="button" onclick="Teacher.confirmAttendanceImport()" class="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white"><i class="fa-solid fa-check mr-1"></i> Confirm Import</button>
    </div>`;
  };

  Teacher.resolveAttendanceImport = function(index, studentId) {
    const r = Teacher._attendanceImport?.rows?.[index]; if (!r) return;
    const student = (Teacher._attendanceImportRoster || []).find(s => String(s.id) === String(studentId));
    r.student = student || null; r.status = student ? 'matched' : 'unmatched';
    Teacher.renderAttendanceImportPreview();
  };

  Teacher.confirmAttendanceImport = async function() {
    const data = Teacher._attendanceImport; if (!data) return;
    const matched = data.rows.filter(r => r.status === 'matched' && r.student);
    if (!matched.length) return Toast.show('Nothing to Import', 'No matched students are ready to import.', 'error');
    if (!confirm(`Import attendance for ${matched.length} matched student${matched.length === 1 ? '' : 's'} on ${data.date}?`)) return;
    try {
      const session = await api('POST', '/attendance/sessions', { classId: Teacher.state.classId, sessionDate: data.date });
      for (const r of matched) await api('PUT', `/attendance/sessions/${session.id}/records/${r.student.id}`, { status: 'present' });
      if (document.getElementById('att-import-absent')?.checked) {
        const presentIds = new Set(matched.map(r => String(r.student.id)));
        for (const s of (Teacher._attendanceImportRoster || [])) if (!presentIds.has(String(s.id))) await api('PUT', `/attendance/sessions/${session.id}/records/${s.id}`, { status: 'absent' });
      }
      await api('POST', `/attendance/sessions/${session.id}/close`);
      Toast.show('Attendance Imported', `${matched.length} student${matched.length === 1 ? '' : 's'} recorded as present.`, 'success');
      Teacher._attendanceImport = null; await Teacher.renderAttendance();
    } catch (e) {}
  };

  const originalAttendance = Teacher.renderAttendance.bind(Teacher);
  Teacher.renderAttendance = async function() {
    await originalAttendance();
    const box = document.getElementById('teacher-tab-content'); if (!box || box.querySelector('[data-att-import]')) return;
    const heading = Array.from(box.querySelectorAll('h4')).find(h => h.textContent.toLowerCase().includes('attendance'));
    if (!heading) return;
    const area = heading.parentElement?.parentElement || heading.parentElement;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.dataset.attImport = 'true';
    btn.className = 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100';
    btn.innerHTML = '<i class="fa-solid fa-file-import mr-1"></i> Import Google Form CSV';
    btn.onclick = () => Teacher.openAttendanceImport();
    area?.appendChild(btn);
  };
})();