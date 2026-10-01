// Authoritative Admin -> Users renderer and account-integrity review UI.
// Loaded last by attendance-import.js. Other enhancements provide actions,
// but must not replace Admin.renderUsers.
(() => {
  if (typeof Admin === 'undefined' || typeof api !== 'function') return;
  const e = value => typeof esc === 'function' ? esc(value) : String(value ?? '');
  let users = [];

  const familyName = (u, role) => String(role === 'teacher' ? u.t_last || '' : role === 'student' ? u.s_last || '' : 'Administrator');
  const firstName = (u, role) => String(role === 'teacher' ? u.t_first || '' : role === 'student' ? u.s_first || '' : '');
  const displayName = (u, role) => {
    if (role === 'teacher') return `${u.t_last || ''}, ${u.t_first || ''}`.replace(/^,\s*|,\s*$/g, '').trim().toUpperCase();
    if (role === 'student') return `${u.s_last || ''}, ${u.s_first || ''} ${u.s_middle || ''}`.replace(/^,\s*|,\s*$/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
    return 'ADMINISTRATOR';
  };
  const sortByFamilyName = role => (a, b) =>
    familyName(a, role).localeCompare(familyName(b, role), undefined, { sensitivity: 'base' }) ||
    firstName(a, role).localeCompare(firstName(b, role), undefined, { sensitivity: 'base' });

  const verificationBadge = u => {
    const status = u.account_verification_status || 'verified';
    const styles = status === 'verified'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'rejected'
        ? 'bg-red-50 text-red-700'
        : 'bg-amber-100 text-amber-800';
    return `<span class="rounded-full px-2 py-1 text-[10px] font-black uppercase ${styles}">${e(status.replaceAll('_', ' '))}</span>`;
  };

  const actions = u => `<div class="flex flex-wrap gap-2">
    ${u.role === 'teacher' ? `<button onclick="Admin.openTeacherUnfinalize('${e(u.id)}')" class="rounded-lg bg-amber-50 px-2.5 py-1.5 font-bold text-amber-800 hover:bg-amber-100"><i class="fa-solid fa-lock-open mr-1"></i>Unfinalized</button>` : ''}
    ${u.student_id_claim_id ? `<button onclick="Admin.reviewStudentIdClaim('${e(u.student_id_claim_id)}')" class="rounded-lg bg-orange-100 px-2.5 py-1.5 font-bold text-orange-900 hover:bg-orange-200"><i class="fa-solid fa-id-card mr-1"></i>Review ID Claim</button>` : ''}
    ${u.duplicate_review_id ? `<button onclick="Admin.reviewPossibleDuplicate('${e(u.duplicate_review_id)}')" class="rounded-lg bg-amber-100 px-2.5 py-1.5 font-bold text-amber-900 hover:bg-amber-200"><i class="fa-solid fa-user-shield mr-1"></i>Review Match</button>` : ''}
    ${u.role !== 'admin' && !u.duplicate_review_id && !u.student_id_claim_id ? `<button onclick="Admin.correctRole('${e(u.id)}')" class="rounded-lg bg-blue-50 px-2.5 py-1.5 font-bold text-blue-700 hover:bg-blue-100"><i class="fa-solid fa-user-pen mr-1"></i>Correct Role</button>` : ''}
    <button onclick="Admin.resetPasswordForUser('${e(u.id)}')" class="rounded-lg bg-violet-50 px-2.5 py-1.5 font-bold text-violet-700 hover:bg-violet-100"><i class="fa-solid fa-key mr-1"></i>Reset Password</button>
    ${!u.is_active && u.account_verification_status === 'rejected'
      ? '<span class="rounded-lg bg-slate-100 px-2.5 py-1.5 font-bold text-slate-500">Archived / Rejected</span>'
      : `<button onclick="Admin.${u.is_active ? 'deactivate' : 'reactivate'}('${e(u.id)}')" class="rounded-lg px-2.5 py-1.5 font-bold ${u.is_active ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}">${u.is_active ? 'Deactivate' : 'Reactivate'}</button>`}
  </div>`;

  const table = (title, icon, rows, role) => {
    const showId = role === 'student';
    return `<section class="glass-card rounded-2xl overflow-hidden" data-account-panel="${role}">
      <div class="border-b border-slate-200 px-5 py-4"><h3 class="font-black text-slate-900"><i class="fa-solid ${icon} mr-2 text-blue-700"></i>${title}</h3><p class="mt-1 text-xs text-slate-500"><span data-visible-count>${rows.length}</span> account${rows.length === 1 ? '' : 's'}</p></div>
      <div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr><th class="text-left p-3">Name</th>${showId ? '<th class="text-left p-3">Student ID</th>' : ''}<th class="text-left p-3">Email</th><th class="text-left p-3">Status</th><th class="text-left p-3">Actions</th></tr></thead><tbody>
      ${rows.length ? rows.map(u => {
        const name = displayName(u, role);
        const search = [name, u.student_number || '', u.claimed_student_number || '', u.email || ''].join(' ').toLowerCase();
        const idDisplay=u.student_id_claim_role==='claimant'?`<span class="font-black text-orange-700">Claiming ${e(u.claimed_student_number)}</span>`:e(u.student_number||'—');
        return `<tr class="border-t border-slate-100" data-account-row data-search="${e(search)}"><td class="p-3 font-bold">${e(name || '—')}</td>${showId ? `<td class="p-3 font-semibold text-slate-600">${idDisplay}</td>` : ''}<td class="p-3">${e(u.email)}</td><td class="p-3"><div class="flex flex-wrap items-center gap-1.5"><span class="font-bold ${u.is_active ? 'text-emerald-600' : 'text-red-600'}">${u.is_active ? 'Active' : 'Deactivated'}</span><span>· ${e(u.approval_status)}</span>${showId ? verificationBadge(u) : ''}</div></td><td class="p-3">${actions(u)}</td></tr>`;
      }).join('') : `<tr><td colspan="${showId ? 5 : 4}" class="p-5 text-center text-slate-400">No accounts in this panel.</td></tr>`}
      </tbody></table></div></section>`;
  };

  Admin.renderUsers = async function () {
    const box = document.getElementById('admin-tab-content');
    if (!box) return;
    box.innerHTML = '<div class="p-6 text-sm font-bold text-slate-500">Loading Teacher and Student accounts…</div>';
    try { users = await api('GET', '/admin/users'); }
    catch { box.innerHTML = '<div class="p-6 text-sm font-bold text-red-600">Unable to load user accounts.</div>'; return; }
    const teachers = users.filter(u => u.role === 'teacher').sort(sortByFamilyName('teacher'));
    const students = users.filter(u => u.role === 'student').sort(sortByFamilyName('student'));
    const admins = users.filter(u => u.role === 'admin');
    const flagged = students.filter(u => u.duplicate_review_id || u.student_id_claim_id).length;
    box.innerHTML = `
      <div class="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div class="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><h3 class="font-black text-slate-900">Account Management</h3><p class="mt-1 text-xs text-slate-600">Names are uppercase, family-name first, and sorted alphabetically. Search by name, Student ID, or email.</p>${flagged ? `<p class="mt-2 text-xs font-black text-amber-800"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${flagged} learner account${flagged === 1 ? '' : 's'} awaiting identity review.</p>` : ''}</div>
        <button type="button" onclick="SmartGradePasswordReset.openQueue()" class="rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-sm"><i class="fa-solid fa-key mr-1"></i> Password Reset Requests</button>
      </div>
      <div class="mb-5"><label for="admin-account-search" class="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Search accounts</label><div class="relative max-w-xl"><i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i><input id="admin-account-search" type="search" autocomplete="off" placeholder="Search name, Student ID, or email" class="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"></div></div>
      <div class="space-y-5">${table('Teacher Panel', 'fa-chalkboard-user', teachers, 'teacher')}${table('Student Panel', 'fa-user-graduate', students, 'student')}${admins.length ? table('Administrator', 'fa-user-shield', admins, 'admin') : ''}</div>`;
    const search = document.getElementById('admin-account-search');
    search?.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      box.querySelectorAll('[data-account-panel]').forEach(panel => {
        let visible = 0;
        panel.querySelectorAll('[data-account-row]').forEach(row => {
          const match = !q || String(row.dataset.search || '').includes(q);
          row.classList.toggle('hidden', !match);
          if (match) visible++;
        });
        const count = panel.querySelector('[data-visible-count]');
        if (count) count.textContent = String(visible);
      });
    });
  };

  Admin.resetPasswordForUser = function (userId) {
    const user = users.find(row => String(row.id) === String(userId));
    return Admin.resetPassword(userId, user?.email || '');
  };

  const accountCard = (label, review, prefix, inventory) => {
    const id = review[`${prefix}_user_id`];
    const name = `${review[`${prefix}_last`] || ''}, ${review[`${prefix}_first`] || ''} ${review[`${prefix}_middle`] || ''}`.replace(/\s+/g, ' ').toUpperCase();
    return `<section class="rounded-2xl border border-slate-200 bg-white p-4" data-reviewed-user="${e(id)}"><div class="text-[10px] font-black uppercase text-slate-400">${label}</div><h4 class="mt-1 font-black text-slate-900">${e(name)}</h4><p class="text-xs text-slate-600">Student ID: <b>${e(review[`${prefix}_student_number`])}</b></p><p class="text-xs text-slate-600">${e(review[`${prefix}_email`])}</p><div class="mt-3 grid grid-cols-2 gap-1 text-[11px] text-slate-600">${Object.entries(inventory).map(([k,v]) => `<span>${e(k.replace(/([A-Z])/g,' $1'))}: <b>${e(v)}</b></span>`).join('')}</div></section>`;
  };

  Admin.reviewPossibleDuplicate = async function (reviewId) {
    let data;
    try { data = await api('GET', `/admin/account-integrity/reviews/${reviewId}`); } catch { return; }
    const { review, candidateInventory, matchedInventory } = data;
    const old = document.getElementById('sg-integrity-modal'); if (old) old.remove();
    const modal = document.createElement('div'); modal.id = 'sg-integrity-modal'; modal.className = 'fixed inset-0 z-[170] flex items-center justify-center bg-slate-950/60 p-4';
    modal.innerHTML = `<div class="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-slate-50 shadow-2xl"><div class="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-6 py-5"><div><div class="text-[10px] font-black uppercase tracking-widest text-amber-700">Account Integrity Review</div><h3 class="text-xl font-black text-slate-900">Possible Duplicate Learners</h3><p class="mt-1 text-xs text-slate-500">Compare ownership before resolving. No action below deletes academic records.</p></div><button data-close class="text-xl text-slate-400">✕</button></div><div class="p-6"><div class="grid gap-4 md:grid-cols-2">${accountCard('Account A',review,'candidate',candidateInventory)}${accountCard('Account B',review,'matched',matchedInventory)}</div><div class="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900"><b>Important:</b> Academic records are linked to each internal account ID. Student ID restoration changes official ID labels transactionally but does not silently move grades, attendance, or enrollment.</div><div class="mt-5 grid gap-4 lg:grid-cols-3"><button data-distinct class="rounded-2xl bg-emerald-600 p-4 text-left text-white"><b class="block">Both Are Legitimate</b><span class="text-xs">Verify both as different learners.</span></button><button data-reject class="rounded-2xl bg-red-600 p-4 text-left text-white"><b class="block">Reject One Account</b><span class="text-xs">Deactivate a confirmed invalid account.</span></button><button data-restore class="rounded-2xl bg-blue-700 p-4 text-left text-white"><b class="block">Restore Student IDs</b><span class="text-xs">Reassign two verified official IDs.</span></button></div><div data-action-form class="mt-5"></div></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector('[data-close]').onclick=()=>modal.remove();
    const form=modal.querySelector('[data-action-form]');
    const refresh=()=>{modal.remove();Admin.renderUsers();};
    modal.querySelector('[data-distinct]').onclick=()=>{form.innerHTML='<form class="rounded-2xl border bg-white p-4"><label class="text-xs font-black">Verification note</label><textarea name="note" required minlength="5" class="mt-1 w-full rounded-xl border p-3 text-sm" placeholder="How identity was verified"></textarea><button class="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">Confirm Both Learners</button></form>';form.querySelector('form').onsubmit=async ev=>{ev.preventDefault();if(!confirm('Confirm these are different legitimate learners?'))return;try{const r=await api('POST',`/admin/account-integrity/reviews/${reviewId}/confirm-distinct`,{note:ev.currentTarget.note.value});Toast.show('Accounts Verified',r.message,'success');refresh();}catch{}};};
    modal.querySelector('[data-reject]').onclick=()=>{form.innerHTML=`<form class="rounded-2xl border bg-white p-4"><label class="text-xs font-black">Account to reject</label><select name="rejectedUserId" required class="mt-1 w-full rounded-xl border p-3 text-sm"><option value="${e(review.candidate_user_id)}">Account A — ${e(review.candidate_student_number)}</option><option value="${e(review.matched_user_id)}">Account B — ${e(review.matched_student_number)}</option></select><label class="mt-3 block text-xs font-black">Reason</label><textarea name="note" required minlength="5" class="mt-1 w-full rounded-xl border p-3 text-sm"></textarea><button class="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white">Reject and Deactivate</button></form>`;form.querySelector('form').onsubmit=async ev=>{ev.preventDefault();if(!confirm('Reject and deactivate the selected account? No records will be deleted.'))return;try{const r=await api('POST',`/admin/account-integrity/reviews/${reviewId}/reject-account`,{rejectedUserId:ev.currentTarget.rejectedUserId.value,note:ev.currentTarget.note.value});Toast.show('Review Resolved',r.message,'success');refresh();}catch{}};};
    modal.querySelector('[data-restore]').onclick=()=>{form.innerHTML=`<form class="rounded-2xl border bg-white p-4"><label class="text-xs font-black">Legitimate owner of the first official ID</label><select name="legitimateUserId" required class="mt-1 w-full rounded-xl border p-3 text-sm"><option value="${e(review.candidate_user_id)}">Account A</option><option value="${e(review.matched_user_id)}">Account B</option></select><div class="mt-3 grid gap-3 sm:grid-cols-2"><div><label class="text-xs font-black">Legitimate learner's official Student ID</label><input name="legitimateStudentNumber" required class="mt-1 w-full rounded-xl border p-3 text-sm"></div><div><label class="text-xs font-black">Other learner's official Student ID</label><input name="otherStudentNumber" required class="mt-1 w-full rounded-xl border p-3 text-sm"></div></div><label class="mt-3 block text-xs font-black">Verification/recovery note</label><textarea name="note" required minlength="5" class="mt-1 w-full rounded-xl border p-3 text-sm"></textarea><button class="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white">Restore IDs Transactionally</button></form>`;form.querySelector('form').onsubmit=async ev=>{ev.preventDefault();if(!confirm('Reassign these official Student IDs? Academic records will stay with their current internal accounts.'))return;const payload=Object.fromEntries(new FormData(ev.currentTarget));try{const r=await api('POST',`/admin/account-integrity/reviews/${reviewId}/restore-student-id`,payload);Toast.show('Student IDs Restored',r.message,'success');refresh();}catch{}};};
  };

  const claimAccountCard=(label,claim,prefix,inventory)=>{
    const name=`${claim[`${prefix}_last`]||''}, ${claim[`${prefix}_first`]||''} ${claim[`${prefix}_middle`]||''}`.replace(/\s+/g,' ').toUpperCase();
    const idLabel=prefix==='claimant'?`Claiming ${claim.claimed_student_number}`:claim.holder_student_number;
    return `<section class="rounded-2xl border border-slate-200 bg-white p-4"><div class="text-[10px] font-black uppercase text-slate-400">${label}</div><h4 class="mt-1 font-black text-slate-900">${e(name)}</h4><p class="text-xs text-slate-600">Student ID: <b>${e(idLabel)}</b></p><p class="text-xs text-slate-600">${e(claim[`${prefix}_email`])}</p><div class="mt-3 grid grid-cols-2 gap-1 text-[11px] text-slate-600">${Object.entries(inventory).map(([k,v])=>`<span>${e(k.replace(/([A-Z])/g,' $1'))}: <b>${e(v)}</b></span>`).join('')}</div></section>`;
  };

  Admin.reviewStudentIdClaim=async function(claimId){
    let data;try{data=await api('GET',`/admin/account-integrity/claims/${claimId}`);}catch{return;}
    const{claim,claimantInventory,holderInventory,suggestedDestinations}=data;
    document.getElementById('sg-id-claim-review-modal')?.remove();
    const modal=document.createElement('div');modal.id='sg-id-claim-review-modal';modal.className='fixed inset-0 z-[175] flex items-center justify-center bg-slate-950/60 p-4';
    const destinationOptions=[`<option value="${e(claim.claimant_user_id)}">Transfer all holder records to the claimant (Student B)</option>`,...(suggestedDestinations||[]).map(x=>`<option value="${e(x.id)}">Transfer all holder records to ${e(`${x.last_name}, ${x.first_name}`.toUpperCase())} — ${e(x.student_number)}</option>`),'<option value="">No transfer — permitted only when holder has zero academic records</option>'].join('');
    const suggestions=(suggestedDestinations||[]).map(x=>`<div class="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs"><b>${e(`${x.last_name}, ${x.first_name}`.toUpperCase())}</b> · ${e(x.student_number)}<div class="mt-1 text-slate-600">${Object.entries(x.inventory||{}).filter(([k])=>k!=='auditEntries').map(([k,v])=>`${e(k.replace(/([A-Z])/g,' $1'))}: ${e(v)}`).join(' · ')}</div></div>`).join('');
    modal.innerHTML=`<div class="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-slate-50 shadow-2xl"><div class="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-6 py-5"><div><div class="text-[10px] font-black uppercase tracking-widest text-orange-700">Student ID Authority Recovery</div><h3 class="text-xl font-black text-slate-900">Claim for Student ID ${e(claim.claimed_student_number)}</h3><p class="mt-1 text-xs text-slate-500">Verify identity and academic-record ownership before releasing the ID.</p></div><button data-close class="text-xl text-slate-400">✕</button></div><div class="p-6"><div class="grid gap-4 md:grid-cols-2">${claimAccountCard('Claimant / Student B',claim,'claimant',claimantInventory)}${claimAccountCard('Current Holder',claim,'holder',holderInventory)}</div>${suggestions?`<div class="mt-4"><h4 class="mb-2 text-xs font-black uppercase text-slate-500">Possible legitimate Student A account</h4><div class="grid gap-2">${suggestions}</div></div>`:''}<div class="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-900"><b>Do not approve mixed ownership.</b> The selected option transfers every academic record from the current holder to one verified account. If some records belong to Student A and others to Student B, stop and resolve those individual records before approval. Conflicting enrollment, attendance, or grade keys automatically block the transaction.</div><form data-approve class="mt-5 rounded-2xl border bg-white p-4"><label class="text-xs font-black">Verified owner of the current holder's academic records</label><select name="recordDestinationUserId" class="mt-1 w-full rounded-xl border p-3 text-sm">${destinationOptions}</select><label class="mt-3 block text-xs font-black">Registrar verification and recovery note</label><textarea name="note" required minlength="5" class="mt-1 w-full rounded-xl border p-3 text-sm" placeholder="Documents checked, persons contacted, and ownership decision"></textarea><button class="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white">Approve Claim and Restore ${e(claim.claimed_student_number)}</button></form><form data-reject class="mt-4 rounded-2xl border border-red-200 bg-white p-4"><label class="text-xs font-black">Claim rejection reason</label><textarea name="note" required minlength="5" class="mt-1 w-full rounded-xl border p-3 text-sm"></textarea><button class="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white">Reject Claim</button></form></div></div>`;
    document.body.appendChild(modal);modal.querySelector('[data-close]').onclick=()=>modal.remove();
    const refresh=()=>{modal.remove();Admin.renderUsers();};
    modal.querySelector('[data-approve]').onsubmit=async ev=>{ev.preventDefault();if(!confirm(`Restore Student ID ${claim.claimed_student_number} to the verified claimant and archive the current holder?`))return;const payload=Object.fromEntries(new FormData(ev.currentTarget));try{const r=await api('POST',`/admin/account-integrity/claims/${claimId}/approve`,payload);Toast.show('Student ID Restored',r.message,'success');refresh();}catch{}};
    modal.querySelector('[data-reject]').onsubmit=async ev=>{ev.preventDefault();if(!confirm('Reject and deactivate this claimant account?'))return;try{const r=await api('POST',`/admin/account-integrity/claims/${claimId}/reject`,{note:ev.currentTarget.note.value});Toast.show('Claim Rejected',r.message,'success');refresh();}catch{}};
  };
})();
