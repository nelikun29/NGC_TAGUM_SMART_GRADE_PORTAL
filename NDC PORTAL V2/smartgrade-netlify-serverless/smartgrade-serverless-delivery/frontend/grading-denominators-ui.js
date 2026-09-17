// Fixed-denominator controls for Quiz, Performance and Exam periods.
// Keeps assessment-item maximums separate from the denominator used by the grading engine.
(() => {
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const style=document.createElement('style');style.textContent=`
    .sg-denom{margin-top:1rem;padding:1rem;border:1px solid rgba(212,167,44,.35);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(248,250,252,.82));box-shadow:0 14px 34px rgba(7,26,61,.09)}
    .sg-denom-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap}.sg-denom-title{font-weight:900;color:#0b2457}.sg-denom-note{font-size:.75rem;color:#64748b;max-width:720px}.sg-denom-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.75rem;margin-top:.9rem}.sg-denom-card{padding:.85rem;border:1px solid #dbe3ef;border-radius:14px;background:rgba(255,255,255,.82)}.sg-denom-card b{display:block;color:#0b2457;margin-bottom:.15rem}.sg-denom-card small{display:block;color:#64748b;margin-bottom:.55rem}.sg-denom-card input{width:100%;border:1px solid #b9c5d8;border-radius:10px;padding:.55rem .65rem;background:#fff}.sg-denom-status{margin-top:.45rem;font-size:.72rem;font-weight:800}.sg-denom-ok{color:#047857}.sg-denom-warn{color:#b45309}.sg-denom-bad{color:#b91c1c}.sg-denom-actions{display:flex;justify-content:flex-end;margin-top:.85rem}.sg-denom-save{border:0;border-radius:11px;padding:.65rem 1rem;font-weight:900;background:linear-gradient(135deg,#d4a72c,#b88618);color:#071a3d;box-shadow:0 8px 18px rgba(212,167,44,.2);cursor:pointer}.sg-denom-save:disabled{opacity:.5;cursor:not-allowed}
  `;document.head.appendChild(style);

  let loading=false,lastClass=null;
  const configuredFor=(data,c,sub=null)=>{if(c.source_type==='quiz')return Number(data.configured?.quiz||0);if(c.source_type==='performance')return Number(data.configured?.performance||0);if(c.source_type==='exam'&&sub){const k=String(sub.source_filter||sub.name||'').toLowerCase();return Number(data.configured?.exams?.[k]||0);}return 0;};
  const statusHtml=(used,total)=>{if(total===null||total===''||!Number.isFinite(Number(total)))return `<div class="sg-denom-status sg-denom-warn">Configured assessments: ${used} points · denominator not set</div>`;const n=Number(total),cls=used>n?'sg-denom-bad':used===n?'sg-denom-ok':'sg-denom-warn',label=used>n?'exceeds denominator':used===n?'fully configured':'remaining capacity '+(n-used);return `<div class="sg-denom-status ${cls}">Configured assessments: ${used} / ${n} points · ${label}</div>`;};
  async function mount(){
    if(loading||typeof Teacher==='undefined'||!Teacher.state?.classId)return;const host=document.getElementById('sg-dynamic-grading');if(!host||!host.isConnected)return;
    const classId=Teacher.state.classId;if(host.parentElement?.querySelector('.sg-denom[data-class="'+classId+'"]'))return;loading=true;
    try{
      const data=await api('GET',`/grading-denominators/${classId}`);if(!host.isConnected||Teacher.state.classId!==classId)return;
      const relevant=(data.components||[]).filter(c=>['quiz','performance','exam'].includes(c.source_type));if(!relevant.length)return;
      const panel=document.createElement('section');panel.className='sg-denom';panel.dataset.class=classId;
      let cards='';for(const c of relevant){
        if(['quiz','performance'].includes(c.source_type)){const used=configuredFor(data,c);cards+=`<div class="sg-denom-card"><b>${esc(c.name)} Overall Total Score</b><small>Fixed denominator for the entire ${esc(c.name)} component. Missing/unrecorded assessment scores contribute 0 points.</small><input type="number" min="1" step="1" data-c="${c.id}" value="${c.max_points??''}" placeholder="e.g. 100" ${data.state==='finalized'?'disabled':''}>${statusHtml(used,c.max_points==null?null:Number(c.max_points))}</div>`;}
        if(c.source_type==='exam')for(const s of c.subcomponents||[]){const used=configuredFor(data,c,s);cards+=`<div class="sg-denom-card"><b>${esc(s.name)} Overall Total Score</b><small>Fixed denominator for ${esc(s.name)} exams; its grading weight remains ${Number(s.weight_share)}% of the overall grade.</small><input type="number" min="1" step="1" data-c="${c.id}" data-s="${s.id}" value="${s.max_points??''}" placeholder="e.g. 100" ${data.state==='finalized'?'disabled':''}>${statusHtml(used,s.max_points==null?null:Number(s.max_points))}</div>`;}
      }
      panel.innerHTML=`<div class="sg-denom-head"><div><div class="sg-denom-title">Assessment Overall Total Scores</div><div class="sg-denom-note">Use fixed denominators when you want missed activities to count as zero. Example: Quiz Overall Total 100, learner earns 90 → 90/100 × Quiz Weight. Individual quizzes/tasks/exams still keep their own maximum scores.</div></div></div><div class="sg-denom-grid">${cards}</div>${data.state==='finalized'?'<div class="sg-denom-status sg-denom-warn">Finalized configuration is locked. Reopen for Revision to change these totals.</div>':'<div class="sg-denom-actions"><button class="sg-denom-save">Save Overall Totals</button></div>'}`;
      host.parentElement.appendChild(panel);
      panel.querySelector('.sg-denom-save')?.addEventListener('click',async e=>{const btn=e.currentTarget,byComponent=new Map();panel.querySelectorAll('input[data-c]').forEach(inp=>{if(!byComponent.has(inp.dataset.c))byComponent.set(inp.dataset.c,{id:inp.dataset.c,subcomponents:[]});const item=byComponent.get(inp.dataset.c),v=inp.value.trim()===''?null:Number(inp.value);if(inp.dataset.s)item.subcomponents.push({id:inp.dataset.s,maxPoints:v});else item.maxPoints=v;});btn.disabled=true;try{await api('PUT',`/grading-denominators/${classId}`,{components:[...byComponent.values()]});Toast.show('Saved','Assessment Overall Total Scores saved.','success');panel.remove();await mount();}catch{}finally{btn.disabled=false;}});
      lastClass=classId;
    }catch(e){}finally{loading=false;}
  }
  const observer=new MutationObserver(()=>mount());observer.observe(document.body,{childList:true,subtree:true});mount();
})();
