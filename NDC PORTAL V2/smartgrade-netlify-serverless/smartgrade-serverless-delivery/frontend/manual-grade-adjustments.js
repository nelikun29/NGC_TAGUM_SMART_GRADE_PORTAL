// Controlled teacher manual-total adjustments for end-of-semester consolidation.
(() => {
  if (typeof Teacher === 'undefined' || typeof api !== 'function') return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css=document.createElement('style');css.textContent=`
    .sg-adjust-btn{margin-top:7px;border:1px solid #d7a91f;border-radius:999px;padding:5px 11px;background:linear-gradient(135deg,#fff8d6,#f5c84c);color:#102b5c;font-size:10px;font-weight:900;cursor:pointer;box-shadow:0 3px 9px rgba(150,106,0,.18)}
    .sg-adjust-overlay{position:fixed;inset:0;z-index:9999;background:rgba(3,16,42,.72);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:18px}
    .sg-adjust-modal{width:min(600px,96vw);max-height:90vh;overflow:auto;background:linear-gradient(155deg,#fffdf5 0%,#f7fbff 48%,#fff8dd 100%);border:1px solid rgba(221,173,35,.55);border-radius:24px;padding:22px;box-shadow:0 28px 80px rgba(2,18,50,.38),0 0 0 4px rgba(255,255,255,.45)}
    .sg-adjust-modal h3{margin:0;color:#09285d;font-weight:950;font-size:20px;letter-spacing:-.25px}.sg-adjust-name{margin:5px 0 17px;color:#56657b;font-weight:900;text-transform:uppercase;letter-spacing:.35px}
    .sg-adjust-card{position:relative;border:1px solid #d9e2f1;border-left:5px solid #d9a514;border-radius:16px;padding:14px;margin:11px 0;background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(245,249,255,.94));box-shadow:0 6px 16px rgba(19,48,89,.08)}
    .sg-adjust-card:nth-of-type(2){border-left-color:#0ea5a4}.sg-adjust-card:nth-of-type(3){border-left-color:#7c5ce7}.sg-adjust-card:nth-of-type(4){border-left-color:#e77b2f}.sg-adjust-card:nth-of-type(5){border-left-color:#1f7a55}
    .sg-adjust-card b{color:#0b2d67;font-size:16px}.sg-adjust-meta{font-size:12px;color:#60708a;margin:5px 0 9px;font-weight:600}
    .sg-adjust-card input{width:100%;border:1.5px solid #bdcbe0;border-radius:11px;padding:10px 12px;margin-top:6px;background:#fff;color:#17243b;font-weight:800;box-shadow:inset 0 1px 2px rgba(16,42,83,.04);transition:.18s}
    .sg-adjust-card input:focus,.sg-adjust-common textarea:focus{outline:none;border-color:#d6a414;box-shadow:0 0 0 3px rgba(230,180,37,.18)}
    .sg-adjust-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:9px}.sg-adjust-common{margin-top:16px;padding-top:16px;border-top:1px solid #d6dfed}.sg-adjust-common textarea{width:100%;border:1.5px solid #bdcbe0;border-radius:12px;padding:10px 12px;min-height:78px;background:#fff;transition:.18s}.sg-adjust-common-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}
    .sg-adjust-actions button,.sg-adjust-close,.sg-adjust-save-all{border:0;border-radius:11px;padding:9px 14px;font-weight:900;cursor:pointer;transition:transform .15s,box-shadow .15s,filter .15s}
    .sg-adjust-reset{background:linear-gradient(135deg,#eef2f7,#dfe7f1);color:#45546a;box-shadow:0 3px 8px rgba(40,55,80,.08)}.sg-adjust-reset:not(:disabled):hover{transform:translateY(-1px);filter:brightness(.98)}
    .sg-adjust-close{background:#e8edf4;color:#34445c}.sg-adjust-save-all{background:linear-gradient(135deg,#0a2d67,#164f9c);color:#fff;box-shadow:0 7px 16px rgba(10,45,103,.25)}.sg-adjust-save-all:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 9px 20px rgba(10,45,103,.32)}
    .sg-adjust-save-all:disabled,.sg-adjust-reset:disabled{opacity:.48;cursor:not-allowed;box-shadow:none}.sg-adjust-locked{opacity:.62}.sg-adjust-badge{display:inline-block;margin-left:7px;padding:3px 7px;border-radius:999px;background:linear-gradient(135deg,#fff1b8,#ffd45c);color:#8a5600;font-size:9px;font-weight:950;vertical-align:2px}
  `;document.head.appendChild(css);
  const labels={attendance:'Attendance',quiz:'Quiz',performance:'Performance Task',exam:'Exam'};
  async function open(row){
    const classId=Teacher.state.classId;let data;
    try{data=await api('GET',`/grades/${classId}/students/${row.studentId}/adjustments`);}catch{return;}
    const locked=['finalized','released'].includes(row.status);
    const overlay=document.createElement('div');overlay.className='sg-adjust-overlay';
    const entries=Object.entries(data).filter(([,x])=>x&&x.available);
    const cards=entries.map(([k,x])=>{const adjusted=Math.abs(Number(x.currentAdjustmentPoints||0))>.000001;
      const label=x.componentName||labels[k]||k;
      return `<div class="sg-adjust-card" data-component="${esc(k)}"><b>${esc(label)}</b>${adjusted?'<span class="sg-adjust-badge">ADJUSTED</span>':''}<div class="sg-adjust-meta">Required Total: ${x.max} ${esc(x.label)} · Recorded: ${x.recordedTotal} · Effective: ${x.currentTotal}</div><input class="sg-adjust-value" type="number" min="0" max="${x.max}" step="0.01" value="${x.currentTotal}" placeholder="Learner points (maximum ${x.max})" ${locked?'disabled':''}><div class="sg-adjust-actions"><button class="sg-adjust-reset" ${locked||!adjusted?'disabled':''}>Reset to Recorded</button></div></div>`;}).join('');
    overlay.innerHTML=`<div class="sg-adjust-modal"><h3>Manual Overall Score Adjustment</h3><div class="sg-adjust-name">${esc(row.studentName)}</div>${locked?'<div class="sg-adjust-meta">This learner is finalized/released. Request modification and obtain Admin approval before adjusting totals.</div>':''}${cards}<div class="sg-adjust-common"><textarea class="sg-adjust-common-reason" rows="2" placeholder="Reason for adjustment (required)" ${locked?'disabled':''}></textarea><div class="sg-adjust-common-actions"><button class="sg-adjust-close">Cancel</button><button class="sg-adjust-save-all" ${locked?'disabled':''}>Save Adjustments</button></div></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.sg-adjust-close').onclick=()=>overlay.remove();overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};
    overlay.querySelectorAll('.sg-adjust-card[data-component]').forEach(card=>{const k=card.dataset.component;
      card.querySelector('.sg-adjust-reset')?.addEventListener('click',async()=>{if(!confirm(`Reset ${labels[k]} to the recorded system total?`))return;try{await api('DELETE',`/grades/${classId}/students/${row.studentId}/adjustments/${k}`);Toast.show('Reset',`${labels[k]} reverted to recorded total.`,'success');overlay.remove();await Teacher.renderGradebook();}catch{}});
    });
    overlay.querySelector('.sg-adjust-save-all')?.addEventListener('click',async e=>{
      const reason=overlay.querySelector('.sg-adjust-common-reason')?.value.trim()||'';
      if(reason.length<5){Toast.show('Reason required','Please enter at least 5 characters explaining the adjustment.','error');return;}
      const btn=e.currentTarget;btn.disabled=true;
      try{
        const cards=[...overlay.querySelectorAll('.sg-adjust-card[data-component]')],adjustments={};
        for(const card of cards){
          const k=card.dataset.component,value=Number(card.querySelector('.sg-adjust-value')?.value),max=Number(card.querySelector('.sg-adjust-value')?.max);
          if(!Number.isFinite(value)){Toast.show('Invalid Score',`${labels[k]||k} requires a numeric score.`,'error');return;}
          if(value<0||value>max){Toast.show('Invalid Score',`${labels[k]||k} must be from 0 to ${max}.`,'error');return;}
          adjustments[k]=value;
        }
        await api('PUT',`/grades/${classId}/students/${row.studentId}/adjustments`,{adjustments,reason});
        Toast.show('Saved','All overall score adjustments were saved together successfully.','success');overlay.remove();await Teacher.renderGradebook();
      }catch{}finally{if(btn.isConnected)btn.disabled=false;}
    });
  }
  async function mount(){
    if(Teacher.state?.tab!=='gradebook'||!Teacher.state?.classId)return;const host=document.getElementById('teacher-tab-content');if(!host)return;
    let rows;try{rows=await api('GET',`/grades/${Teacher.state.classId}/gradebook`);}catch{return;}if(!Array.isArray(rows))return;
    const table=[...host.querySelectorAll('table')].find(t=>[...t.querySelectorAll('thead th')].some(th=>/student/i.test(th.textContent)));if(!table)return;
    const trs=[...table.querySelectorAll('tbody tr')];trs.forEach(tr=>{if(tr.querySelector('.sg-adjust-btn'))return;const text=tr.textContent.toUpperCase();const row=rows.find(r=>text.includes(String(r.studentNumber||'').toUpperCase())||text.includes(String(r.studentName||'').toUpperCase()));if(!row)return;const cell=tr.children[0];if(!cell)return;const b=document.createElement('button');b.className='sg-adjust-btn';b.textContent='Adjust Overall Totals';b.onclick=()=>open(row);cell.appendChild(document.createElement('br'));cell.appendChild(b);});
  }
  const original=Teacher.renderGradebook?.bind(Teacher);if(original)Teacher.renderGradebook=async function(){await original();setTimeout(mount,0);};
  let queued=false;new MutationObserver(()=>{if(queued||Teacher.state?.tab!=='gradebook')return;queued=true;setTimeout(()=>{queued=false;mount();},40);}).observe(document.body,{childList:true,subtree:true});setTimeout(mount,0);
})();