// Teacher Dashboard student-name presentation normalization.
// Display-only: stored names and student profile data remain unchanged.
(() => {
  if (typeof Teacher === 'undefined') return;

  const style=document.createElement('style');
  style.id='sg-teacher-student-uppercase';
  style.textContent=`
    #teacher-section .sg-student-display-name,
    #teacher-tab-content .sg-student-display-name{
      text-transform:uppercase!important;
      letter-spacing:.012em;
    }
  `;
  document.head.appendChild(style);

  const normalize=s=>String(s||'').trim().replace(/\s+/g,' ').toUpperCase();

  function uppercaseKnownNames(root=document){
    if (!root) return;
    const roster=Array.isArray(Teacher.state?.roster)?Teacher.state.roster:[];
    const names=new Set();
    roster.forEach(s=>{
      const first=s.first_name||s.firstName||'';
      const last=s.last_name||s.lastName||'';
      const full=s.studentName||s.name||`${last}, ${first}`;
      [full,`${first} ${last}`,`${last}, ${first}`].forEach(n=>{if(String(n).trim())names.add(String(n).trim());});
    });
    const candidates=root.querySelectorAll('#teacher-section td,#teacher-section th,#teacher-section p,#teacher-section span,#teacher-section button,#teacher-tab-content td,#teacher-tab-content p,#teacher-tab-content span');
    candidates.forEach(el=>{
      if(el.children.length) return;
      const current=(el.textContent||'').trim();
      if(!current) return;
      const match=[...names].find(n=>current===n);
      if(match){el.textContent=normalize(current);el.classList.add('sg-student-display-name');}
    });
  }

  // Gradebook has an authoritative student-name column; normalize it after every render.
  const originalGradebook=Teacher.renderGradebook?.bind(Teacher);
  if(originalGradebook) Teacher.renderGradebook=async function(){await originalGradebook();uppercaseKnownNames(document.getElementById('teacher-tab-content'));};

  // Apply to Students, Approvals and assessment rosters without changing stored data.
  const originalSwitch=Teacher.switchTab?.bind(Teacher);
  if(originalSwitch) Teacher.switchTab=async function(tab){const result=await originalSwitch(tab);setTimeout(()=>uppercaseKnownNames(document.getElementById('teacher-section')),0);return result;};

  let queued=false;
  const host=document.getElementById('teacher-section');
  if(host)new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    setTimeout(()=>{queued=false;uppercaseKnownNames(host);},25);
  }).observe(host,{childList:true,subtree:true});
  setTimeout(()=>uppercaseKnownNames(host||document),0);
})();