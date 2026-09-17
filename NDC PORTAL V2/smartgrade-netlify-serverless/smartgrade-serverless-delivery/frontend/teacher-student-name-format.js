// Teacher Dashboard student-name presentation normalization.
// Display-only: stored names and student profile data remain unchanged.
(() => {
  if (typeof Teacher === 'undefined') return;

  const style=document.createElement('style');
  style.id='sg-teacher-student-uppercase';
  style.textContent=`
    #teacher-grade-table tbody td:first-child,
    #teacher-tab-content [data-sg-student-name]{
      text-transform:uppercase!important;
      letter-spacing:.012em;
    }
  `;
  document.head.appendChild(style);

  const upper=v=>String(v??'').toUpperCase();

  // Gradebook is deterministic: the first column is always Student.
  // CSS handles this directly, so it does not depend on a separate roster cache.

  // For the other Teacher tabs, normalize exact names using the text already
  // rendered by those views. This keeps the database/original profile untouched.
  function normalizeOtherTeacherNames(root){
    if(!root)return;
    const tab=Teacher.state?.tab;
    if(tab==='gradebook')return;

    // Approvals render each learner name as a <b> immediately above email.
    if(tab==='approvals'){
      root.querySelectorAll('b').forEach(el=>{
        const parent=el.parentElement;
        if(parent?.querySelector('p') && /@/.test(parent.querySelector('p')?.textContent||'')){
          el.textContent=upper(el.textContent.trim());
          el.dataset.sgStudentName='true';
        }
      });
      return;
    }

    // Attendance / quiz / performance / exam roster tables: identify the
    // Student/Name column from its header, then uppercase that column only.
    root.querySelectorAll('table').forEach(table=>{
      const headers=[...table.querySelectorAll('thead th')];
      const index=headers.findIndex(th=>/^(student|student name|name|learner|learner name)$/i.test(th.textContent.trim()));
      if(index<0)return;
      table.querySelectorAll('tbody tr').forEach(tr=>{
        const cell=tr.children[index];
        if(!cell)return;
        const target=cell.querySelector('b,strong,[data-student-name]')||cell;
        if(target.children.length===0){target.textContent=upper(target.textContent.trim());target.dataset.sgStudentName='true';}
      });
    });
  }

  function apply(){
    const root=document.getElementById('teacher-tab-content');
    if(!root)return;
    normalizeOtherTeacherNames(root);
  }

  // Run after every tab renderer without altering its API/data behavior.
  const originalSwitch=Teacher.switchTab?.bind(Teacher);
  if(originalSwitch)Teacher.switchTab=function(tab){
    const result=originalSwitch(tab);
    Promise.resolve(result).finally(()=>setTimeout(apply,0));
    return result;
  };

  const host=document.getElementById('teacher-tab-content');
  if(host){
    let queued=false;
    new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      setTimeout(()=>{queued=false;apply();},20);
    }).observe(host,{childList:true,subtree:true});
  }

  setTimeout(apply,0);
})();