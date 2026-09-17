// Flexible grading builder. Loaded last.
(() => {
  const h = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = s => s ? ({...s, components:(s.components||[]).map(c=>({...c, componentKey:c.componentKey??c.component_key, sourceType:c.sourceType??c.source_type, calculationMethod:c.calculationMethod??c.calculation_method, maxPoints:c.maxPoints??(c.max_points==null?null:Number(c.max_points)), isActive:c.isActive??c.is_active, subcomponents:(c.subcomponents||[]).map(x=>({...x, subcomponentKey:x.subcomponentKey??x.subcomponent_key, weightShare:x.weightShare??Number(x.weight_share), sourceFilter:x.sourceFilter??x.source_filter, isActive:x.isActive??x.is_active}))}))}) : s;

  const css = document.createElement('style');
  css.textContent = `
  :root{--sg-blue:#2563eb;--sg-ink:#0f172a;--sg-muted:#64748b}
  #student-section,#teacher-section{position:relative}
  #student-section:before,#teacher-section:before{content:'';position:fixed;z-index:-1;inset:0;background:radial-gradient(circle at 8% 12%,rgba(59,130,246,.09),transparent 24%),radial-gradient(circle at 88% 18%,rgba(14,165,233,.07),transparent 22%),linear-gradient(180deg,#f8fbff 0%,#f5f8fc 100%);pointer-events:none}
  #student-section .glass-card,#teacher-section .glass-card{border:1px solid rgba(255,255,255,.82);background:linear-gradient(145deg,rgba(255,255,255,.84),rgba(248,250,252,.70));box-shadow:0 12px 35px rgba(15,23,42,.07);backdrop-filter:blur(18px) saturate(145%);-webkit-backdrop-filter:blur(18px) saturate(145%)}
  #student-section .tab-btn,#teacher-section .tab-btn{border-radius:12px 12px 0 0;transition:background .18s ease,color .18s ease,transform .18s ease}
  #student-section .tab-btn:hover,#teacher-section .tab-btn:hover{background:rgba(239,246,255,.8);transform:translateY(-1px)}
  #student-section button:focus-visible,#teacher-section button:focus-visible,#student-section input:focus-visible,#teacher-section input:focus-visible,#student-section select:focus-visible,#teacher-section select:focus-visible{outline:3px solid rgba(59,130,246,.22)!important;outline-offset:2px}
  #student-section table,#teacher-section table{border-collapse:separate;border-spacing:0}
  #student-section thead th,#teacher-section thead th{background:rgba(241,245,249,.82);color:#475569;font-size:.72rem;letter-spacing:.035em;text-transform:uppercase}
  #student-section tbody tr:hover,#teacher-section tbody tr:hover{background:rgba(239,246,255,.62)}
  .sg-student-class-card,#teacher-section article{position:relative!important;isolation:isolate;background:linear-gradient(135deg,rgba(219,234,254,.90),rgba(255,255,255,.80) 48%,rgba(224,242,254,.88))!important;border:1px solid rgba(96,165,250,.58)!important;box-shadow:0 18px 45px rgba(37,99,235,.15),0 5px 15px rgba(15,23,42,.07)!important;backdrop-filter:blur(20px) saturate(150%);-webkit-backdrop-filter:blur(20px) saturate(150%);transition:transform .22s ease,box-shadow .22s ease!important}
  .sg-student-class-card{border-left:6px solid var(--sg-blue)!important;overflow:hidden}
  .sg-student-class-card:hover,#teacher-section article:hover{transform:translateY(-4px);box-shadow:0 26px 60px rgba(37,99,235,.20),0 10px 24px rgba(15,23,42,.09)!important}
  .sg-dg-shell{max-width:1100px;margin:0 auto}
  .sg-dg-intro{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1rem;padding:1rem 1.1rem;border:1px solid rgba(191,219,254,.75);border-radius:16px;background:linear-gradient(135deg,rgba(239,246,255,.92),rgba(255,255,255,.78))}
  .sg-dg-panel{padding:1.2rem;border:1px solid rgba(147,197,253,.48);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.90),rgba(239,246,255,.72));box-shadow:0 16px 40px rgba(37,99,235,.08);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
  .sg-dg-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}.sg-dg-title{font-weight:900;color:#0f172a;font-size:1.05rem}.sg-dg-state{font-size:11px;font-weight:900;text-transform:uppercase;padding:.35rem .7rem;border-radius:999px;background:linear-gradient(135deg,#dbeafe,#e0f2fe);color:#1e40af;border:1px solid #bfdbfe}
  .sg-dg-labels,.sg-dg-row{display:grid;grid-template-columns:minmax(160px,1fr) 100px 150px 42px;gap:.55rem;align-items:center}.sg-dg-labels{margin-top:1rem;padding:0 .1rem;color:#64748b;font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.sg-dg-row{margin:.55rem 0}
  .sg-dg-row input,.sg-dg-row select,.sg-dg-days input{width:100%;border:1px solid #cbd5e1;border-radius:11px;padding:.58rem;background:rgba(255,255,255,.9)}
  .sg-dg-days{display:grid;grid-template-columns:minmax(180px,1fr) 130px;gap:.75rem;align-items:center;margin:.35rem 0 .8rem;padding:.8rem;background:rgba(239,246,255,.82);border:1px solid rgba(191,219,254,.7);border-radius:12px}
  .sg-dg-sub{margin:.4rem 0 .9rem 1.25rem;padding:.65rem .75rem;border-left:3px solid #bfdbfe;background:rgba(248,250,252,.65);border-radius:0 12px 12px 0}.sg-dg-actions{display:flex;gap:.55rem;flex-wrap:wrap;margin-top:1.15rem;align-items:center;padding-top:1rem;border-top:1px solid rgba(203,213,225,.65)}
  .sg-dg-btn{border:0;border-radius:11px;padding:.62rem .9rem;font-weight:800;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}.sg-dg-btn:hover{transform:translateY(-1px)}.sg-dg-primary{background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;box-shadow:0 6px 16px rgba(37,99,235,.18)}.sg-dg-secondary{background:#e2e8f0;color:#0f172a}.sg-dg-danger{background:#fee2e2;color:#b91c1c}.sg-dg-total{font-weight:900;margin-left:auto}.sg-dg-total.bad{color:#b91c1c}.sg-dg-total.good{color:#047857}
  @media(max-width:640px){.sg-dg-labels{display:none}.sg-dg-row{grid-template-columns:1fr 78px}.sg-dg-row select{grid-column:1/-1}.sg-dg-days{grid-template-columns:1fr}.sg-dg-total{width:100%;margin-left:0}.sg-dg-intro{flex-direction:column}.sg-student-class-card,#teacher-section article{backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}}
  @media(prefers-reduced-motion:reduce){#student-section *,#teacher-section *{transition-duration:.01ms!important;animation-duration:.01ms!important}}
  `;
  document.head.appendChild(css);

  if (typeof Teacher !== 'undefined' && Teacher.createAssessment) Teacher.createAssessment = async function(kind){
    const title=prompt('Assessment title:'); if(!title)return;
    const maximum=Number(prompt(kind==='quizzes'?'Total items:':'Maximum score:','100'));
    if(!Number.isFinite(maximum)||maximum<=0){Toast.show('Error','Maximum score/total items must be greater than 0.','error');return;}
    let examType=null;if(kind==='exams'){examType=prompt('Exam period (Prelim, Midterm, or Final):','Prelim');if(!examType?.trim())return;}
    const ep=kind==='quizzes'?'/assessments/quizzes':kind==='performance'?'/assessments/performance-tasks':'/assessments/exams';
    const payload={classId:Teacher.state.classId,title,...(kind==='quizzes'?{totalItems:maximum}:{maxScore:maximum}),...(examType?{examType:examType.trim()}:{})};
    try{await api('POST',ep,payload);Toast.show('Created','Assessment created successfully.','success');Teacher.renderAssessment(kind);}catch{}
  };

  let model=null;
  const total=()=>model.components.filter(c=>c.isActive!==false).reduce((s,c)=>s+Number(c.weight||0),0);
  function validateLocal(){
    if(Math.abs(total()-100)>.01)return `Weights must total 100%. Current total: ${total()}%.`;
    const a=model.components.find(c=>c.isActive!==false&&c.sourceType==='attendance');
    if(a&&(!Number.isFinite(Number(a.maxPoints))||Number(a.maxPoints)<=0))return 'Set Attendance Total Required Days to a number greater than 0.';
    for(const c of model.components){const subs=(c.subcomponents||[]).filter(s=>s.isActive!==false);if(subs.length){const st=subs.reduce((x,s)=>x+Number(s.weightShare||0),0);if(Math.abs(st-Number(c.weight||0))>.01)return `${c.name} subcomponents must total ${Number(c.weight||0)}% of the overall grade. Current total: ${st}%.`;}}
    return null;
  }

  function draw(){
    const host=document.getElementById('sg-dynamic-grading');if(!host||!model)return;const locked=model.state==='finalized';
    host.innerHTML=`<div class="sg-dg-head"><div><div class="sg-dg-title">Flexible Grading System</div><div class="text-xs text-slate-500 mt-1">This is the authoritative grading configuration for this class. Active component weights must total exactly 100%.</div></div><span class="sg-dg-state">${h(model.state||'draft')}</span></div><div class="sg-dg-labels"><span>Component</span><span>Weight %</span><span>Source</span><span></span></div><div id="sg-dg-components"></div><div class="sg-dg-actions">${locked?'':'<button class="sg-dg-btn sg-dg-secondary" data-act="add">+ Add Component</button>'}<span class="sg-dg-total ${Math.abs(total()-100)<.01?'good':'bad'}">Total: ${total()}%</span>${locked?'':'<button class="sg-dg-btn sg-dg-primary" data-act="save">Save Changes</button>'}${model.state==='draft'?'<button class="sg-dg-btn sg-dg-primary" data-act="activate">Save & Activate</button>':''}${model.state==='active'?'<button class="sg-dg-btn sg-dg-primary" data-act="finalize">Finalize</button>':''}</div>`;
    const box=host.querySelector('#sg-dg-components');
    model.components.forEach((c,i)=>{const d=document.createElement('div');d.innerHTML=`<div class="sg-dg-row"><input data-i="${i}" data-f="name" value="${h(c.name)}" ${locked?'disabled':''}><input data-i="${i}" data-f="weight" type="number" min="0" max="100" step="0.01" value="${Number(c.weight)}" ${locked?'disabled':''}><select data-i="${i}" data-f="sourceType" ${locked?'disabled':''}><option value="attendance">Attendance</option><option value="quiz">Quiz</option><option value="performance">Performance</option><option value="exam">Exam</option><option value="custom">Custom</option></select>${locked?'':'<button class="sg-dg-btn sg-dg-danger" data-remove="'+i+'" title="Remove component">×</button>'}</div>${c.sourceType==='attendance'?`<div class="sg-dg-days"><div><b class="text-xs text-slate-700">Attendance Total Required Days</b><div class="text-[11px] text-slate-500 mt-1">Fixed semester denominator. Example: 11 present out of 15 required days = 11/15.</div></div><input data-i="${i}" data-f="maxPoints" type="number" min="1" step="1" placeholder="e.g. 15" value="${c.maxPoints??''}" ${locked?'disabled':''}></div>`:''}${c.sourceType==='exam'?`<div class="sg-dg-sub"><div class="text-[11px] text-slate-500 mb-2">Split the ${Number(c.weight)}% Examination weight directly. These shares must total ${Number(c.weight)}% of the overall grade.</div>${locked?'':`<button class="sg-dg-btn sg-dg-secondary" data-exam="${i}">Set Prelim / Midterm / Final</button>`}${(c.subcomponents||[]).map((s,j)=>`<div class="sg-dg-row"><input value="${h(s.name)}" disabled><input data-si="${i}" data-sj="${j}" type="number" min="0" max="100" step="0.01" value="${Number(s.weightShare)}" ${locked?'disabled':''}><span class="text-xs text-slate-500">% Overall</span></div>`).join('')}</div>`:''}`;const sel=d.querySelector('select');if(sel)sel.value=c.sourceType;box.appendChild(d);});
    host.querySelectorAll('[data-i][data-f]').forEach(el=>el.oninput=()=>{const c=model.components[+el.dataset.i],f=el.dataset.f;c[f]=(f==='weight'||f==='maxPoints')?(el.value===''?null:Number(el.value)):el.value;if(f==='sourceType')draw();else{const t=host.querySelector('.sg-dg-total');t.textContent=`Total: ${total()}%`;t.className=`sg-dg-total ${Math.abs(total()-100)<.01?'good':'bad'}`;}});
    host.querySelectorAll('[data-si]').forEach(el=>el.oninput=()=>model.components[+el.dataset.si].subcomponents[+el.dataset.sj].weightShare=Number(el.value));
    host.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{model.components.splice(+b.dataset.remove,1);draw();});
    host.querySelectorAll('[data-exam]').forEach(b=>b.onclick=()=>{const c=model.components[+b.dataset.exam],w=Number(c.weight||0),third=Math.floor((w/3)*100)/100,last=Math.round((w-third*2)*100)/100;c.subcomponents=[{name:'Prelim',subcomponentKey:'prelim',weightShare:third,sourceFilter:'Prelim',isActive:true},{name:'Midterm',subcomponentKey:'midterm',weightShare:third,sourceFilter:'Midterm',isActive:true},{name:'Final',subcomponentKey:'final',weightShare:last,sourceFilter:'Final',isActive:true}];draw();});
    host.querySelector('[data-act="add"]')?.addEventListener('click',()=>{model.components.push({name:'New Component',weight:0,sourceType:'custom',calculationMethod:'average_percentage',isActive:true,subcomponents:[]});draw();});
    host.querySelector('[data-act="save"]')?.addEventListener('click',save);
    host.querySelector('[data-act="activate"]')?.addEventListener('click',async()=>{if(await save())await setState('active');});
    host.querySelector('[data-act="finalize"]')?.addEventListener('click',async()=>{if(confirm('Finalize this grading scheme? Normal teacher editing will be locked.'))await setState('finalized');});
  }

  async function save(){const err=validateLocal();if(err){Toast.show('Invalid Grading Setup',err,'error');return false;}try{const r=await api('PUT',`/grading-schemes/${Teacher.state.classId}`,{name:model.name||'Class Grading Scheme',components:model.components});model=normalize(r.scheme);draw();Toast.show('Saved','Grading configuration saved successfully.','success');return true;}catch{return false;}}
  async function setState(s){try{const r=await api('POST',`/grading-schemes/${Teacher.state.classId}/state`,{state:s});model=normalize(r.scheme);draw();Toast.show('Updated',`Grading scheme is now ${s}.`,'success');}catch{}}

  async function renderWeightsHome(){
    const tab=document.getElementById('teacher-tab-content');if(!tab||typeof Teacher==='undefined'||!Teacher.state?.classId)return;
    tab.innerHTML=`<div class="sg-dg-shell"><div class="sg-dg-intro"><div><div class="text-xs font-black uppercase tracking-wider text-blue-700">Class Grading Configuration</div><h3 class="mt-1 text-xl font-black text-slate-900">Weights & Grading Scheme</h3><p class="mt-1 text-xs text-slate-500">Configure the grading rules used by the Gradebook. The former fixed-weight editor has been replaced by this flexible system.</p></div><div class="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800"><i class="fa-solid fa-circle-info mr-1"></i> Gradebook displays results; Weights controls the formula.</div></div><div id="sg-dynamic-grading" class="sg-dg-panel"><div class="text-sm font-bold text-slate-500">Loading grading configuration…</div></div></div>`;
    try{let r=await api('GET',`/grading-schemes/${Teacher.state.classId}`);if(!r.scheme)r=await api('POST',`/grading-schemes/${Teacher.state.classId}/initialize`,{});model=normalize(r.scheme);draw();}catch{const host=document.getElementById('sg-dynamic-grading');if(host)host.innerHTML='<div class="text-sm font-bold text-amber-700">Flexible grading setup is currently unavailable. Please verify the grading database migration and API connection.</div>';}
  }

  if(typeof Teacher!=='undefined'){
    // The Weights tab is now the single authoritative editor for grading configuration.
    Teacher.renderWeights = renderWeightsHome;
  }
})();
