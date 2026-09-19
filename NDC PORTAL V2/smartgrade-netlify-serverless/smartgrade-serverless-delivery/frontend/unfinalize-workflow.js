// Teacher -> Admin grade unfinalization workflow and organized Admin user panels.
(() => {
  if (typeof api !== 'function') return;
  const e=v=>typeof esc==='function'?esc(v):String(v??'');
  const fmt=d=>d?new Date(d).toLocaleString():'—';

  if (typeof Teacher !== 'undefined') {
    let requestMap=new Map();
    Teacher.unfinalizeRequestMap=requestMap;
    const originalRow=Teacher.gradebookRow?.bind(Teacher);
    const originalRender=Teacher.renderGradebook?.bind(Teacher);

    Teacher.requestUnfinalize=async function(studentId){
      const reason=prompt('Reason for requesting this Final Grade to be unfinalized:\n\nExplain what needs to be corrected. This request will be reviewed by the administrator.');
      if(reason===null)return;
      if(reason.trim().length<5){Toast.show('Reason Required','Enter a reason of at least 5 characters.','error');return;}
      if(!confirm('Submit this unfinalize request to the administrator? The grade will remain locked until the administrator approves it.'))return;
      try{
        const r=await api('POST',`/grades/${Teacher.state.classId}/students/${studentId}/request-unfinalize`,{reason:reason.trim()});
        Toast.show('Request Submitted',r.message||'Request sent to the administrator.','success');
        await Teacher.renderGradebook();
      }catch{}
    };

    if(originalRow) Teacher.gradebookRow=function(r){
      let html=originalRow(r);
      if(!['finalized','released'].includes(r.status))return html;
      const pending=requestMap.get(r.studentId)?.status==='pending';
      const btn=pending
        ? '<button type="button" disabled class="ml-2 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700"><i class="fa-solid fa-clock mr-1"></i>Unfinalize Pending</button>'
        : `<button type="button" onclick="Teacher.requestUnfinalize('${e(r.studentId)}')" class="ml-2 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-black text-red-700 hover:bg-red-100"><i class="fa-solid fa-lock-open mr-1"></i>Request Unfinalize</button>`;
      const rowEnd=html.lastIndexOf('</tr>'), cellEnd=html.lastIndexOf('</td>',rowEnd);
      if(cellEnd>=0)html=html.slice(0,cellEnd)+btn+html.slice(cellEnd);
      return html;
    };

    if(originalRender) Teacher.renderGradebook=async function(){
      const cid=Teacher.state?.classId;
      requestMap=new Map();
      Teacher.unfinalizeRequestMap=requestMap;
      if(cid){
        try{const rows=await api('GET',`/grades/${cid}/unfinalize-requests`);for(const r of rows||[])if(!requestMap.has(r.student_id))requestMap.set(r.student_id,r);Teacher.unfinalizeRequestMap=requestMap;}catch{}
      }
      return originalRender();
    };
  }

  if (typeof Admin !== 'undefined') {
    let users=[];
    Admin.unfinalizeTeacherId='';
    // admin-role-correction.js loads before this enhancement. Preserve its
    // working role-correction handler before this file replaces renderUsers.
    const roleCorrectionHandler = typeof Admin.correctRole === 'function'
      ? Admin.correctRole.bind(Admin)
      : null;
    Admin.correctRole = function(userId){
      if(roleCorrectionHandler)return roleCorrectionHandler(userId);
      Toast.show('Role Correction Unavailable','Reload the page and try again.','error');
    };
    const originalRender=Admin.render?.bind(Admin);
    const originalSwitch=Admin.switchTab?.bind(Admin);

    function addUnfinalizeTab(){
      const bar=document.querySelector('#admin-section #admin-tab-content')?.previousElementSibling;
      if(!bar||bar.querySelector('[data-admin-unfinalize]'))return;
      const btn=document.createElement('button');
      btn.type='button';btn.dataset.adminUnfinalize='1';
      btn.className='tab-btn px-4 py-2 capitalize';
      btn.innerHTML='<i class="fa-solid fa-lock-open mr-1"></i> Unfinalize';
      btn.onclick=()=>Admin.switchTab('unfinalize');
      bar.appendChild(btn);
      if(typeof ApprovalManager!=='undefined')ApprovalManager.updateEnhancedUI();
    }

    if(originalRender) Admin.render=async function(){await originalRender();addUnfinalizeTab();};

    Admin.switchTab=function(tab){
      if(tab!=='unfinalize')return originalSwitch?originalSwitch(tab):undefined;
      Admin.tab='unfinalize';addUnfinalizeTab();
      document.querySelectorAll('#admin-section .tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.adminUnfinalize==='1'));
      return Admin.renderUnfinalizeRequests();
    };

    Admin.openTeacherUnfinalize=function(teacherId){
      Admin.unfinalizeTeacherId=teacherId||'';
      Admin.switchTab('unfinalize');
    };

    Admin.renderUsers=async function(){
      const box=document.getElementById('admin-tab-content');if(!box)return;
      box.innerHTML='<div class="p-6 text-sm font-bold text-slate-500">Loading Teacher and Student accounts…</div>';
      try{users=await api('GET','/admin/users');}catch{users=[];}
      const sortByFamilyName=(a,b,role)=>{
        const aLast=String(role==='teacher'?a.t_last||'':role==='student'?a.s_last||'':'Administrator');
        const bLast=String(role==='teacher'?b.t_last||'':role==='student'?b.s_last||'':'Administrator');
        const byLast=aLast.localeCompare(bLast,undefined,{sensitivity:'base'});
        if(byLast)return byLast;
        const aFirst=String(role==='teacher'?a.t_first||'':role==='student'?a.s_first||'':'');
        const bFirst=String(role==='teacher'?b.t_first||'':role==='student'?b.s_first||'':'');
        return aFirst.localeCompare(bFirst,undefined,{sensitivity:'base'});
      };
      const teachers=users.filter(u=>u.role==='teacher').sort((a,b)=>sortByFamilyName(a,b,'teacher'));
      const students=users.filter(u=>u.role==='student').sort((a,b)=>sortByFamilyName(a,b,'student'));
      const admins=users.filter(u=>u.role==='admin');
      const displayName=(u,role)=>{
        if(role==='teacher')return `${u.t_last||''}, ${u.t_first||''}`.replace(/^,\s*|,\s*$/g,'').trim().toUpperCase();
        if(role==='student')return `${u.s_last||''}, ${u.s_first||''} ${u.s_middle||''}`.replace(/^,\s*|,\s*$/g,'').replace(/\s+/g,' ').trim().toUpperCase();
        return 'ADMINISTRATOR';
      };
      const actions=u=>`<div class="flex flex-wrap gap-2">${u.role==='teacher'?`<button onclick="Admin.openTeacherUnfinalize('${e(u.id)}')" class="rounded-lg bg-amber-50 px-2.5 py-1.5 font-bold text-amber-800 hover:bg-amber-100"><i class="fa-solid fa-lock-open mr-1"></i>Unfinalized</button>`:''}${u.role!=='admin'?`<button onclick="Admin.correctRole('${e(u.id)}')" class="rounded-lg bg-blue-50 px-2.5 py-1.5 font-bold text-blue-700 hover:bg-blue-100"><i class="fa-solid fa-user-pen mr-1"></i>Correct Role</button>`:''}<button onclick="Admin.resetPassword('${e(u.id)}')" class="rounded-lg bg-violet-50 px-2.5 py-1.5 font-bold text-violet-700 hover:bg-violet-100"><i class="fa-solid fa-key mr-1"></i>Reset Password</button><button onclick="Admin.${u.is_active?'deactivate':'reactivate'}('${e(u.id)}')" class="rounded-lg px-2.5 py-1.5 font-bold ${u.is_active?'bg-red-50 text-red-600':'bg-emerald-50 text-emerald-700'}">${u.is_active?'Deactivate':'Reactivate'}</button></div>`;
      const table=(title,icon,rows,role)=>{
        const showId=role==='student';
        return `<section class="glass-card rounded-2xl overflow-hidden" data-account-panel="${role}"><div class="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 class="font-black text-slate-900"><i class="fa-solid ${icon} mr-2 text-blue-700"></i>${title}</h3><p class="mt-1 text-xs text-slate-500"><span data-visible-count>${rows.length}</span> account${rows.length===1?'':'s'}</p></div></div><div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr><th class="text-left p-3">Name</th>${showId?'<th class="text-left p-3">ID No.</th>':''}<th class="text-left p-3">Email</th><th class="text-left p-3">Status</th><th class="text-left p-3">Actions</th></tr></thead><tbody>${rows.length?rows.map(u=>{const name=displayName(u,role);const search=[name,u.student_number||'',u.email||''].join(' ').toLowerCase();return `<tr class="border-t border-slate-100" data-account-row data-search="${e(search)}"><td class="p-3 font-bold">${e(name||'—')}</td>${showId?`<td class="p-3 font-semibold text-slate-600">${e(u.student_number||'—')}</td>`:''}<td class="p-3">${e(u.email)}</td><td class="p-3"><span class="font-bold ${u.is_active?'text-emerald-600':'text-red-600'}">${u.is_active?'Active':'Deactivated'}</span> · ${e(u.approval_status)}</td><td class="p-3">${actions(u)}</td></tr>`;}).join(''):`<tr><td colspan="${showId?5:4}" class="p-5 text-center text-slate-400">No accounts in this panel.</td></tr>`}</tbody></table></div></section>`;
      };
      box.innerHTML=`<div class="mb-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h3 class="font-black text-slate-900">Account Management</h3><p class="mt-1 text-xs text-slate-600">Names are arranged alphabetically by family name. Search Teacher and Student accounts by name, Student ID, or email.</p></div><div class="w-full lg:max-w-md"><label for="admin-account-search" class="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Search accounts</label><div class="relative"><i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i><input id="admin-account-search" type="search" autocomplete="off" placeholder="Search name, ID No., or email" class="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"></div></div></div></div><div class="space-y-5">${table('Teacher Panel','fa-chalkboard-user',teachers,'teacher')}${table('Student Panel','fa-user-graduate',students,'student')}${admins.length?table('Administrator','fa-user-shield',admins,'admin'):''}</div>`;
      const search=document.getElementById('admin-account-search');
      if(search)search.addEventListener('input',()=>{
        const q=search.value.trim().toLowerCase();
        box.querySelectorAll('[data-account-panel]').forEach(panel=>{
          let visible=0;
          panel.querySelectorAll('[data-account-row]').forEach(row=>{
            const match=!q||String(row.dataset.search||'').includes(q);
            row.classList.toggle('hidden',!match);
            if(match)visible++;
          });
          const count=panel.querySelector('[data-visible-count]');if(count)count.textContent=String(visible);
        });
      });
    };

    Admin.renderUnfinalizeRequests=async function(){
      const box=document.getElementById('admin-tab-content');if(!box)return;
      box.innerHTML='<div class="p-6 text-sm font-bold text-slate-500">Loading unfinalize requests…</div>';
      const teacherId=Admin.unfinalizeTeacherId||'';
      let rows=[];try{rows=await api('GET','/admin/unfinalize-requests'+(teacherId?`?teacherId=${encodeURIComponent(teacherId)}`:''));}catch{}
      const pending=rows.filter(r=>r.status==='pending'),history=rows.filter(r=>r.status!=='pending');
      const card=r=>`<article class="rounded-2xl border ${r.status==='pending'?'border-amber-200 bg-amber-50/55':'border-slate-200 bg-white/75'} p-4 shadow-sm"><div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div class="flex flex-wrap items-center gap-2"><span class="rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${r.status==='pending'?'bg-amber-100 text-amber-800':r.status==='approved'?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}">${e(r.status)}</span><span class="text-xs font-bold text-slate-500">${e(r.requested_status)} → In Progress</span></div><h4 class="mt-2 font-black text-slate-900">${e(r.student_last)}, ${e(r.student_first)} <span class="font-medium text-slate-500">· ${e(r.student_number||'')}</span></h4><p class="mt-1 text-xs text-slate-600">${e(r.subject)} · ${e(r.section)} · Teacher: <b>${e(r.teacher_first)} ${e(r.teacher_last)}</b></p><div class="mt-3 rounded-xl bg-white/80 p-3 text-xs text-slate-700"><b>Teacher reason:</b> ${e(r.reason)}</div><p class="mt-2 text-[10px] text-slate-400">Requested ${e(fmt(r.requested_at))}${r.reviewed_at?' · Reviewed '+e(fmt(r.reviewed_at)):''}</p>${r.admin_note?`<p class="mt-1 text-xs text-slate-500"><b>Admin note:</b> ${e(r.admin_note)}</p>`:''}</div>${r.status==='pending'?`<div class="flex shrink-0 gap-2"><button onclick="Admin.reviewUnfinalize('${e(r.id)}','reject')" class="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">Reject</button><button onclick="Admin.reviewUnfinalize('${e(r.id)}','approve')" class="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"><i class="fa-solid fa-lock-open mr-1"></i>Approve Unfinalize</button></div>`:''}</div></article>`;
      box.innerHTML=`<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 class="text-lg font-black text-slate-900">Grade Unfinalize Requests</h3><p class="mt-1 text-xs text-slate-500">Teacher requests require administrator approval before a finalized or released grade returns to In Progress.</p></div>${teacherId?'<button onclick="Admin.unfinalizeTeacherId=\'\';Admin.renderUnfinalizeRequests()" class="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">Show All Teachers</button>':''}</div><div class="mb-5 grid grid-cols-2 gap-3"><div class="glass-card rounded-2xl p-4"><div class="text-2xl font-black text-amber-700">${pending.length}</div><div class="text-xs font-bold text-slate-500">Pending Review</div></div><div class="glass-card rounded-2xl p-4"><div class="text-2xl font-black text-slate-700">${history.length}</div><div class="text-xs font-bold text-slate-500">Reviewed History</div></div></div><div class="space-y-3">${pending.length?pending.map(card).join(''):'<div class="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold text-emerald-700">No pending unfinalize requests.</div>'}</div>${history.length?`<h4 class="mb-3 mt-7 font-black text-slate-800">Review History</h4><div class="space-y-3">${history.map(card).join('')}</div>`:''}`;
    };

    Admin.reviewUnfinalize=async function(id,decision){
      let note='';
      if(decision==='reject'){note=prompt('Reason for rejecting this request:')||'';if(note.trim().length<3){if(note!==null)Toast.show('Reason Required','Enter a brief rejection reason.','error');return;}}
      else {note=prompt('Optional administrator note for this approval:')||'';if(!confirm('Approve this request? The learner grade will return to In Progress and the teacher can edit it again.'))return;}
      try{const r=await api('POST',`/admin/unfinalize-requests/${id}/${decision}`,{note:note.trim()});Toast.show(decision==='approve'?'Grade Unfinalized':'Request Rejected',r.message,'success');Admin.renderUnfinalizeRequests();}catch{}
    };

    if(Store?.user?.role==='admin')setTimeout(()=>{addUnfinalizeTab();if(Admin.tab==='users')Admin.renderUsers();},0);
  }
})();