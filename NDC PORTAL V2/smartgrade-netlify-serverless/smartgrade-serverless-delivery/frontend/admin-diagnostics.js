// Admin Account Diagnostics enhancement.
// Loaded after app.js. Uses the existing authenticated api(), Toast, and Admin objects.
(() => {
  if (typeof Admin === 'undefined' || typeof api !== 'function') return;

  Admin.openDiagnostics = async function(userId) {
    try {
      const d = await api('GET', `/admin/users/${userId}/diagnostics`);
      const old = document.getElementById('admin-account-diagnostics');
      if (old) old.remove();

      const check = (ok, yes, no) =>
        `<div class="flex items-center justify-between gap-3 py-2 border-b border-slate-100">
          <span class="text-sm text-slate-600">${yes}</span>
          <span class="text-xs font-black ${ok ? 'text-emerald-600' : 'text-red-600'}">
            <i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
            ${ok ? 'OK' : no}
          </span>
        </div>`;

      const u = d.user || {};
      const c = d.checks || {};
      const enrollment = d.enrollment;
      const modal = document.createElement('div');
      modal.id = 'admin-account-diagnostics';
      modal.className = 'fixed inset-0 z-[120] flex items-center justify-center p-4';
      modal.innerHTML = `
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onclick="Admin.closeDiagnostics()"></div>
        <div class="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div class="bg-eduBlue-600 text-white px-5 py-4 flex items-start justify-between gap-3">
            <div>
              <h3 class="font-black text-lg"><i class="fa-solid fa-stethoscope mr-2"></i>Account Diagnostics</h3>
              <p class="text-xs text-white/80 mt-1">${esc(u.email || '')} · ${esc(u.role || '')}</p>
            </div>
            <button type="button" onclick="Admin.closeDiagnostics()" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="p-5">
            <div class="rounded-xl border border-slate-200 px-4">
              ${check(c.active, 'Account active', 'DEACTIVATED')}
              ${check(c.approved, 'Administrator approval', String(u.approvalStatus || '').toUpperCase())}
              ${check(c.profileLinked, 'Role/profile linkage', 'MISSING PROFILE')}
              ${check(!c.locked, 'Login lock', 'LOCKED')}
            </div>

            <div class="mt-4 rounded-xl ${d.canAuthenticate ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'} border p-4">
              <p class="font-black ${d.canAuthenticate ? 'text-emerald-700' : 'text-amber-800'}">
                ${d.canAuthenticate ? 'No account-state blocker detected' : 'Account-state blocker detected'}
              </p>
              <p class="text-sm text-slate-600 mt-1">${esc(d.diagnosis || '')}</p>
            </div>

            <div class="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div class="rounded-xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Failed Login Attempts</p>
                <p class="font-black text-lg">${Number(u.failedLoginAttempts || 0)}</p>
              </div>
              <div class="rounded-xl bg-slate-50 p-3">
                <p class="text-xs text-slate-500">Locked Until</p>
                <p class="font-bold text-xs mt-1 break-words">${esc(u.lockedUntil || 'Not locked')}</p>
              </div>
            </div>

            ${enrollment ? `
              <div class="mt-4">
                <p class="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Student Enrollments</p>
                <div class="grid grid-cols-4 gap-2 text-center">
                  <div class="rounded-xl bg-slate-50 p-2"><b>${enrollment.active || 0}</b><br><span class="text-[10px] text-slate-500">Active</span></div>
                  <div class="rounded-xl bg-slate-50 p-2"><b>${enrollment.pending || 0}</b><br><span class="text-[10px] text-slate-500">Pending</span></div>
                  <div class="rounded-xl bg-slate-50 p-2"><b>${enrollment.dropped || 0}</b><br><span class="text-[10px] text-slate-500">Dropped</span></div>
                  <div class="rounded-xl bg-slate-50 p-2"><b>${enrollment.rejected || 0}</b><br><span class="text-[10px] text-slate-500">Rejected</span></div>
                </div>
              </div>` : ''}

            <div class="mt-5 flex flex-wrap justify-end gap-2">
              ${c.locked ? `<button type="button" onclick="Admin.unlockFromDiagnostics('${userId}')" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold"><i class="fa-solid fa-unlock mr-1"></i> Unlock Account</button>` : ''}
              <button type="button" onclick="Admin.closeDiagnostics()" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold">Close</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
    } catch (_) {}
  };

  Admin.closeDiagnostics = function() {
    const modal = document.getElementById('admin-account-diagnostics');
    if (modal) modal.remove();
  };

  Admin.unlockFromDiagnostics = async function(userId) {
    try {
      await api('POST', `/admin/users/${userId}/unlock`);
      Toast.show('Unlocked', 'Account login lock cleared.', 'success');
      await Admin.openDiagnostics(userId);
    } catch (_) {}
  };

  const originalRenderUsers = Admin.renderUsers.bind(Admin);
  Admin.renderUsers = async function() {
    await originalRenderUsers();
    const box = document.getElementById('admin-tab-content');
    if (!box) return;
    const rows = box.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const actionCell = row.lastElementChild;
      if (!actionCell || actionCell.querySelector('[data-account-diagnostics]')) return;
      const stateButton = actionCell.querySelector('button[onclick*="Admin.deactivate"],button[onclick*="Admin.reactivate"]');
      const match = stateButton && stateButton.getAttribute('onclick').match(/\('([^']+)'\)/);
      if (!match) return;
      const id = match[1];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.accountDiagnostics = '1';
      btn.className = 'text-xs font-bold text-eduBlue-600 ml-3';
      btn.innerHTML = '<i class="fa-solid fa-stethoscope mr-1"></i>Diagnose';
      btn.onclick = () => Admin.openDiagnostics(id);
      actionCell.appendChild(btn);
    });
  };
})();
