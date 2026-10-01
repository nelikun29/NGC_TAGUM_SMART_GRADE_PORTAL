// Admin protected account-role correction enhancement.
(() => {
  if (typeof Admin === 'undefined') return;
  const e = v => typeof esc === 'function' ? esc(v) : String(v ?? '');
  let users = [];

  function modal(user) {
    const toStudent = user.role === 'teacher';
    const wrap = document.createElement('div');
    wrap.id = 'sg-role-modal';
    wrap.className = 'fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4';
    wrap.innerHTML = `<div class="w-full max-w-xl rounded-3xl border border-white/70 bg-white/95 shadow-2xl overflow-hidden">
      <div class="bg-gradient-to-r from-blue-700 to-sky-500 px-6 py-5 text-white"><div class="text-[10px] font-black uppercase tracking-[.18em] text-blue-100">Protected Admin Action</div><h3 class="mt-1 text-xl font-black">Correct Account Role</h3><p class="mt-1 text-xs text-blue-100">${e(user.email)} · ${e(user.role)} → ${toStudent?'student':'teacher'}</p></div>
      <form id="sg-role-form" class="p-6 space-y-4">
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><b>This is a role correction, not a simple role switch.</b> Required profile data will be validated before the account is converted.</div>
        ${toStudent ? `
          <div><label class="text-xs font-bold text-slate-700">Student ID / Student Number *</label><input name="studentNumber" required class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="Enter official Student ID"></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label class="text-xs font-bold text-slate-700">First Name *</label><input name="firstName" required value="${e(user.t_first||'')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"></div><div><label class="text-xs font-bold text-slate-700">Last Name *</label><input name="lastName" required value="${e(user.t_last||'')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"></div></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label class="text-xs font-bold text-slate-700">Middle Name</label><input name="middleName" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"></div><div><label class="text-xs font-bold text-slate-700">Year Level *</label><input name="yearLevel" required class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" placeholder="e.g. 1st Year"></div></div>
          <div><label class="text-xs font-bold text-slate-700">Room Number</label><input name="roomNumber" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"></div>` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label class="text-xs font-bold text-slate-700">First Name *</label><input name="firstName" required value="${e(user.s_first||'')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"></div><div><label class="text-xs font-bold text-slate-700">Last Name *</label><input name="lastName" required value="${e(user.s_last||'')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"></div></div><div><label class="text-xs font-bold text-slate-700">Department</label><input name="department" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"></div>`}
        <div class="flex justify-end gap-2 pt-2"><button type="button" data-close class="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-700">Cancel</button><button type="submit" class="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-blue-200">Validate & Correct Role</button></div>
      </form></div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('[data-close]').onclick=()=>wrap.remove();
    wrap.onclick=ev=>{if(ev.target===wrap)wrap.remove();};
    wrap.querySelector('#sg-role-form').onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);const payload={targetRole:toStudent?'student':'teacher'};for(const [k,v] of f.entries())payload[k]=String(v).trim();if(!confirm(`Confirm role correction to ${payload.targetRole.toUpperCase()}? The existing login account will be preserved.`))return;try{const r=await api('POST',`/admin/users/${user.id}/correct-role`,payload);wrap.remove();Toast.show('Role Corrected',r.message,'success');Admin.renderUsers();ApprovalManager?.forceRefresh?.();}catch{}};
  }

  Admin.correctRole = async id => {
    let u=users.find(x=>String(x.id)===String(id));
    if(!u){
      try{
        const fresh=await api('GET','/admin/users');
        users=Array.isArray(fresh)?fresh:[];
        u=users.find(x=>String(x.id)===String(id));
      }catch{}
    }
    if(!u){Toast.show('Account Not Found','Unable to load this account for role correction.','error');return;}
    modal(u);
  };
})();
