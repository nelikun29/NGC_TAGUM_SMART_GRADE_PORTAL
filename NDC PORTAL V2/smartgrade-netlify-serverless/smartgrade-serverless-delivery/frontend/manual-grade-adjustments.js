// Controlled teacher manual-total adjustments for end-of-semester consolidation.
(() => {
  if (typeof Teacher === 'undefined' || typeof api !== 'function') return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css=document.createElement('style');css.textContent=`
    .sg-adjust-btn{margin-top:6px;border:1px solid #d4a72c;border-radius:8px;padding:4px 8px;background:#fff8dc;color:#0b2457;font-size:10px;font-weight:900;cursor:pointer}
    .sg-adjust-overlay{position:fixed;inset:0;z-index:9999;background:rgba(2,12,32,.65);display:flex;align-items:center;justify-content:center;padding:18px}
    .sg-adjust-modal{width:min(560px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.3)}
    .sg-adjust-modal h3{margin:0;color:#0b2457;font-weight:900}.sg-adjust-name{margin:4px 0 16px;color:#475569;font-weight:800;text-transform:uppercase}
    .sg-adjust-card{border:1px solid #dbe3ef;border-radius:14px;padding:12px;margin:10px 0}.sg-adjust-card b{color:#0b2457}.sg-adjust-meta{font-size:12px;color:#64748b;margin:4px 0 8px}
    .sg-adjust-card input,.sg-adjust-card textarea{width:100%;border:1px solid #b9c5d8;border-radius:9px;padding:8px;margin-top:6px}.sg-adjust-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
    .sg-adjust-actions button,.sg-adjust-close{border:0;border-radius:9px;padding:7px 10px;font-weight:800;cursor:pointer}.sg-adjust-save{background:#0b2457;color:white}.sg-adjust-reset{background:#f1f5f9;color:#334155}.sg-adjust-close{background:#e2e8f0;color:#334155}
    .sg-adjust-locked{opacity:.55}.sg-adjust-badge{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:9px;font-weight:900}
  `;document.head.appendChild(css);
  const labels={attendance:'Attendance',quiz:'Quiz',performance:'Performance Task'};
  async function open(row){
    const classId=Teacher.state.classId;let data;
    try{data=await api('GET',`/grades/${classId}/students/${row.studentId}/adjustments`);}catch{return;}
    const locked=['finalized','released'].includes(row.status);
    const overlay=document.createElement('div');overlay.className='sg-adjust-overlay';
    const cards=Object.keys(labels).map(k=>{const x=data[k];if(!x?.available)return `<div class="sg-adjust-card sg-adjust-locked"><b>${labels[k]}</b><div class="sg-adjust-meta">${esc(x?.message||'Not available for adjustment.')}</div></div>`;
      const adjusted=Math.abs(Number(x.currentAdjustmentPoints||0))>.000001;
      return `<div class="sg-adjust-card" data-component="${k}"><b>${labels[k]}</b>${adjusted?'<span class="sg-adjust-badge">ADJUSTED</span>':''}<div class="sg-adjust-meta">Recorded: ${x.recordedTotal} / ${x.max} ${esc(x.label)} · Effective: ${x.currentTotal} / ${x.max}</div><input class="sg-adjust-value" type="number" min="0" max="${x.max}" step="0.01" value="${x.currentTotal}" ${locked?'disabled':''}><textarea class="sg-adjust-reason" rows="2" placeholder="Reason for adjustment (required)" ${locked?'disabled':''}></textarea><div class="sg-adjust-actions"><button class="sg-adjust-reset" ${locked||!adjusted?'disabled':''}>Reset to Recorded</button><button class="sg-adjust-save" ${locked?'disabled':''}>Save Adjustment</button></div></div>`;}).join('');
    overlay.innerHTML=`<div class="sg-adjust-modal"><h3>Manual Overall Score Adjustment</h3><div class="sg-adjust-name">${esc(row.studentName)}</div>${locked?'<div class="sg-adjust-meta">This learner is finalized/released. Request modification and obtain Admin approval before adjusting totals.</div>':''}${cards}<div style="text-align:right;margin-top:14px"><button class="sg-adjust-close">Close</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.sg-adjust-close').onclick=()=>overlay.remove();overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};
    overlay.querySelectorAll('.sg-adjust-card[data-component]').forEach(card=>{const k=card.dataset.component;
      card.querySelector('.sg-adjust-save')?.addEventListener('click',async()=>{const value=Number(card.querySelector('.sg-adjust-value').value),reason=card.querySelector('.sg-adjust-reason').value.trim();if(reason.length<5){Toast.show('Reason required','Please enter at least 5 characters explaining the adjustment.','error');return;}try{await api('PUT',`/grades/${classId}/students/${row.studentId}/adjustments/${k}`,{newTotal:value,reason});Toast.show('Saved',`${labels[k]} total adjusted successfully.`,'success');overlay.remove();await Teacher.renderGradebook();}catch{}});
      card.querySelector('.sg-adjust-reset')?.addEventListener('click',async()=>{if(!confirm(`Reset ${labels[k]} to the recorded system total?`))return;try{await api('DELETE',`/grades/${classId}/students/${row.studentId}/adjustments/${k}`);Toast.show('Reset',`${labels[k]} reverted to recorded total.`,'success');overlay.remove();await Teacher.renderGradebook();}catch{}});
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