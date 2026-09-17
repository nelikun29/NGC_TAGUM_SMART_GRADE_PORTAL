// Teacher Dashboard Enhancements
// Loaded after app.js. Keeps existing application logic intact and adds:
// - Reference-inspired teacher class cards and selected-class panel
// - Students tab
// - Remove one / Remove All active students
// - Delete attendance session

(() => {
  if (typeof Teacher === 'undefined') return;

  const originalRender = Teacher.render.bind(Teacher);
  const originalSwitchTab = Teacher.switchTab.bind(Teacher);
  const originalRenderAttendance = Teacher.renderAttendance.bind(Teacher);

  const paletteFor = c => {
    const list = [
      ['from-blue-500','via-blue-500','to-sky-400','bg-blue-50','text-blue-700','border-blue-300'],
      ['from-emerald-500','via-green-500','to-emerald-400','bg-emerald-50','text-emerald-700','border-emerald-300'],
      ['from-violet-700','via-purple-600','to-violet-500','bg-violet-50','text-violet-700','border-violet-400']
    ];
    const text = String(c.id || c.subject || '');
    let n = 0;
    for (let i = 0; i < text.length; i++) n += text.charCodeAt(i);
    return list[n % list.length];
  };

  Teacher.renderClassCard = function(c) {
    const studentCount = Number(c.student_count || 0);
    const pendingCount = Number(c.pending_count || 0);
    const selected = String(c.id) === String(Teacher.state.classId);
    const p = paletteFor(c);

    return `
      <article class="overflow-hidden rounded-2xl border ${selected ? `${p[5]} ring-2 ring-violet-200` : 'border-slate-200'} bg-white shadow-lg shadow-slate-200/60 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200">
        <div class="relative overflow-hidden bg-gradient-to-br ${p[0]} ${p[1]} ${p[2]} px-5 py-5 text-white min-h-[116px]">
          <i class="fa-solid fa-book-open absolute -right-2 bottom-[-24px] text-[96px] text-white/10 rotate-[-8deg]"></i>
          <div class="relative flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-center gap-4">
              <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-xl ${p[4]} shadow-sm">
                <i class="fa-solid fa-book-open"></i>
              </span>
              <div class="min-w-0">
                <h4 class="truncate text-xl font-black tracking-tight" title="${esc(c.subject || '')}">${esc(c.subject || 'Untitled Subject')}</h4>
                <p class="mt-1 text-xs font-bold text-white/90">${esc(c.year_level || 'Year Level')} <span class="mx-2">•</span> ${esc(c.section || 'Section')}</p>
              </div>
            </div>
            <div class="flex flex-col items-end gap-2">
              ${selected ? '<span class="rounded-full bg-white/90 px-3 py-1 text-[9px] font-black uppercase tracking-wide text-violet-800">Selected</span>' : ''}
              <span class="rounded-full bg-white/85 px-3 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-700"><i class="fa-solid fa-circle mr-1 text-[7px]"></i>${c.is_active === false ? 'Inactive' : 'Active'}</span>
            </div>
          </div>
        </div>

        <div class="p-5">
          <div class="grid grid-cols-[1fr_auto_1.35fr] items-center gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <span class="text-xl text-slate-400"><i class="fa-solid fa-door-open"></i></span>
              <div><p class="text-[10px] font-semibold text-slate-500">Room</p><p class="text-sm font-black text-slate-800">${esc(c.room_number || 'Not assigned')}</p></div>
            </div>
            <div class="h-12 w-px bg-slate-200"></div>
            <div class="flex min-w-0 items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${p[3]} text-lg ${p[4]}"><i class="fa-solid fa-hashtag"></i></span>
              <div class="min-w-0 flex-1"><p class="text-[10px] font-semibold text-slate-500">Class Code</p><code class="block truncate text-xs font-black text-slate-800">${esc(c.class_code || '—')}</code></div>
              <button type="button" onclick="Teacher.copyClassCode('${esc(c.class_code || '')}')" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200" title="Copy class code"><i class="fa-regular fa-copy"></i></button>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onclick="Teacher.openStudents('${esc(c.id)}')" class="rounded-xl bg-blue-50 px-4 py-3 text-left hover:bg-blue-100 transition">
              <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><i class="fa-solid fa-users"></i></span><div><p class="text-[10px] font-semibold text-slate-500">Students</p><p class="text-lg font-black text-slate-800">${studentCount}</p></div></div>
            </button>
            <button type="button" onclick="Teacher.openApprovals('${esc(c.id)}')" class="rounded-xl bg-amber-50 px-4 py-3 text-left hover:bg-amber-100 transition">
              <div class="flex items-center gap-3"><span class="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400 text-white"><i class="fa-solid fa-clock"></i></span><div><p class="text-[10px] font-semibold text-amber-700">Pending</p><p class="text-lg font-black text-slate-800">${pendingCount}</p></div></div>
            </button>
          </div>

          <button type="button" onclick="Teacher.selectClass('${esc(c.id)}')" class="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 px-3 py-3 text-sm font-black text-white shadow-md hover:from-blue-800 hover:to-blue-700"><i class="fa-solid fa-folder-open"></i> Open Class</button>
          <button type="button" onclick="Teacher.editClass('${esc(c.id)}')" class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"><i class="fa-solid fa-pen-to-square"></i> Edit Class</button>
        </div>
      </article>`;
  };

  Teacher.render = async function() {
    await originalRender();

    // Upgrade selected-class summary to match the reference visual language.
    const selectedName = document.getElementById('teacher-selected-class-name');
    if (selectedName) {
      const cls = Teacher.getSelectedClass();
      const panel = selectedName.closest('.glass-card');
      if (panel && cls && !panel.dataset.referenceEnhanced) {
        panel.dataset.referenceEnhanced = 'true';
        panel.className = 'relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50';
        panel.insertAdjacentHTML('afterbegin', '<div class="absolute left-0 top-0 h-full w-1.5 bg-violet-600"></div>');
      }
    }

    const tabBar = document.querySelector('#teacher-section #teacher-tab-content')?.previousElementSibling;
    if (!tabBar || tabBar.querySelector('[data-enhanced-students-tab]')) return;
    const gradebook = Array.from(tabBar.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('gradebook'));
    if (!gradebook) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.enhancedStudentsTab = 'true';
    btn.className = `tab-btn whitespace-nowrap px-4 py-3 text-sm font-semibold ${Teacher.state.tab === 'students' ? 'active' : ''}`;
    btn.innerHTML = '<i class="fa-solid fa-users mr-1"></i> Students';
    btn.onclick = () => Teacher.switchTab('students');
    gradebook.before(btn);
  };

  Teacher.switchTab = function(tab) {
    Teacher.state.tab = tab;
    if (tab === 'students') {
      document.querySelectorAll('#teacher-section .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.enhancedStudentsTab === 'true'));
      return Teacher.renderStudents();
    }
    return originalSwitchTab(tab);
  };

  Teacher.openStudents = async function(classId) {
    Teacher.state.classId = classId;
    Teacher.state.tab = 'students';
    await Teacher.render();
    Teacher.switchTab('students');
  };

  Teacher.openApprovals = async function(classId) {
    Teacher.state.classId = classId;
    Teacher.state.tab = 'approvals';
    await Teacher.render();
  };

  Teacher.renderStudents = async function() {
    const box = document.getElementById('teacher-tab-content');
    const cid = Teacher.state.classId;
    if (!box || !cid) return;
    box.innerHTML = '<div class="py-10 text-center text-sm text-slate-400">Loading students…</div>';
    const rows = await api('GET', `/classes/${cid}/roster`).catch(() => []);
    const cls = Teacher.getSelectedClass();
    box.innerHTML = `<div class="space-y-4"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 class="font-black text-slate-800">Students</h4><p class="mt-1 text-xs text-slate-500">${rows.length} active student${rows.length === 1 ? '' : 's'} in ${esc(cls?.subject || 'this class')}. Removing a student does not delete the student account or historical academic records.</p></div>${rows.length ? `<button type="button" onclick="Teacher.removeAllStudents()" class="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 hover:bg-red-100"><i class="fa-solid fa-user-minus"></i> Remove All Students</button>` : ''}</div><div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">${rows.length ? rows.map(s => `<div class="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"><div class="flex items-center gap-3 min-w-0"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 font-black text-eduBlue-700">${esc((s.first_name || '?').charAt(0))}${esc((s.last_name || '?').charAt(0))}</span><div class="min-w-0"><p class="truncate text-sm font-black text-slate-800">${esc(s.last_name)}, ${esc(s.first_name)} ${esc(s.middle_name || '')}</p><p class="mt-0.5 text-xs text-slate-500">Student No. ${esc(s.student_number || '—')}</p></div></div><button type="button" onclick="Teacher.removeStudent('${esc(s.id)}', '${esc(`${s.first_name || ''} ${s.last_name || ''}`.trim())}')" class="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"><i class="fa-solid fa-user-minus"></i> Remove</button></div>`).join('') : `<div class="py-12 text-center"><i class="fa-solid fa-users-slash text-2xl text-slate-300"></i><p class="mt-3 text-sm font-bold text-slate-600">No active students</p><p class="mt-1 text-xs text-slate-400">Approved students will appear here.</p></div>`}</div></div>`;
  };

  Teacher.removeStudent = async function(studentId, studentName) {
    if (!confirm(`Remove ${studentName || 'this student'} from this class?\n\nThe student account and historical academic records will be preserved.`)) return;
    try { await api('POST', `/classes/${Teacher.state.classId}/students/${studentId}/remove`); Toast.show('Student Removed', `${studentName || 'Student'} was removed from this class.`, 'success'); await Teacher.render(); } catch {}
  };

  Teacher.removeAllStudents = async function() {
    const cls = Teacher.getSelectedClass();
    const phrase = prompt(`Remove ALL active students from ${cls?.subject || 'this class'}?\n\nStudent accounts and historical records will be preserved. Pending requests will not be affected.\n\nType REMOVE ALL to confirm:`);
    if (phrase !== 'REMOVE ALL') { if (phrase !== null) Toast.show('Not Removed', 'Confirmation text did not match REMOVE ALL.', 'info'); return; }
    try { const data = await api('POST', `/classes/${Teacher.state.classId}/students/remove-all`); Toast.show('Students Removed', data.message || 'All active students were removed.', 'success'); await Teacher.render(); } catch {}
  };

  Teacher.renderAttendance = async function() {
    await originalRenderAttendance();
    const cid = Teacher.state.classId;
    if (!cid) return;
    const rows = await api('GET', `/attendance/classes/${cid}/sessions`).catch(() => []);
    const box = document.getElementById('teacher-tab-content');
    if (!box || !Array.isArray(rows) || !rows.length) return;
    const sessionContainers = box.querySelectorAll('.glass-card > div.p-4');
    sessionContainers.forEach((container, index) => {
      const r = rows[index]; if (!r) return;
      const manage = container.querySelector('button');
      if (!manage || container.querySelector('[data-delete-session]')) return;
      const actions = document.createElement('div');
      actions.className = 'flex items-center gap-3';
      actions.innerHTML = `<button type="button" onclick="Teacher.openSession('${esc(r.id)}')" class="text-xs font-bold text-eduBlue-600">Manage</button><button type="button" data-delete-session onclick="Teacher.deleteAttendanceSession('${esc(r.id)}', '${esc(r.session_date || r.date || 'this session')}')" class="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"><i class="fa-solid fa-trash-can"></i> Delete</button>`;
      manage.replaceWith(actions);
    });
  };

  Teacher.deleteAttendanceSession = async function(sessionId, sessionDate) {
    if (!confirm(`Delete attendance session ${sessionDate}?\n\nAll attendance records recorded specifically for this session will also be deleted. This action cannot be undone.`)) return;
    try { await api('DELETE', `/attendance/sessions/${sessionId}`); Toast.show('Session Deleted', 'Attendance session deleted successfully.', 'success'); await Teacher.renderAttendance(); } catch {}
  };
})();
