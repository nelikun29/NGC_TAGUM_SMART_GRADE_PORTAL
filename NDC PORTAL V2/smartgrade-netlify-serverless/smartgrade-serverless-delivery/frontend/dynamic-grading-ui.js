// Dynamic Grading UI + compatibility fixes. Loaded last, after app.js enhancements.
(() => {
  const escHtml = v => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  const css=document.createElement('style');
  css.textContent=`
  .sg-dg-panel{margin:1rem 0;padding:1rem;border:1px solid #cbd5e1;border-radius:18px;background:#fff;box-shadow:0 10px 28px rgba(15,23,42,.08)}
  .sg-dg-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}.sg-dg-title{font-weight:900;color:#0f172a}.sg-dg-state{font-size:11px;font-weight:900;text-transform:uppercase;padding:.3rem .6rem;border-radius:999px;background:#e2e8f0;color:#334155}
  .sg-dg-row{display:grid;grid-template-columns:minmax(140px,1fr) 90px 130px 42px;gap:.5rem;align-items:center;margin:.55rem 0}.sg-dg-row input,.sg-dg-row select{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:.55rem}.sg-dg-sub{margin-left:1.25rem;padding-left:.75rem;border-left:3px solid #dbeafe}.sg-dg-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1rem}.sg-dg-btn{border:0;border-radius:10px;padding:.55rem .8rem;font-weight:800;cursor:pointer}.sg-dg-primary{background:#2563eb;color:#fff}.sg-dg-secondary{background:#e2e8f0;color:#0f172a}.sg-dg-danger{background:#fee2e2;color:#b91c1c}.sg-dg-total{font-weight:900}.sg-dg-total.bad{color:#b91c1c}.sg-dg-total.good{color:#047857}
  .sg-password-wrap{position:relative}.sg-password-eye{position:absolute;right:.65rem;top:50%;transform:translateY(-50%);border:0;background:transparent;cursor:pointer;font-size:16px;line-height:1;padding:.3rem;color:#475569}.sg-password-wrap input{padding-right:2.5rem!important}
  .sg-student-class-card{position:relative;background:linear-gradient(145deg,#fff 0%,#eff6ff 100%)!important;border:1px solid #93c5fd!important;border-left:6px solid #2563eb!important;box-shadow:0 14px 34px rgba(37,99,235,.13)!important}.sg-student-class-card:before{content:'';position:absolute;inset:0 0 auto 0;height:4px;background:linear-gradient(90deg,#2563eb,#7c3aed);border-radius:16px 16px 0 0}
  @media(max-width:640px){.sg-dg-row{grid-template-columns:1fr 75px}.sg-dg-row select{grid-column:1/2}.sg-dg-row button{grid-column:2/3;grid-row:1/2}}
  `;document.head.appendChild(css);

  // Restore accessible show/hide controls for every password field, including dynamically rendered forms.
  function wirePasswordEyes(root=document){
    root.querySelectorAll('input[type="password"]').forEach(input=>{
      if(input.dataset.sgEye==='1')return; input.dataset.sgEye='1';
      const parent=input.parentElement; if(!parent)return;
      const wrap=document.createElement('div'); wrap.className='sg-password-wrap'; parent.insertBefore(wrap,input); wrap.appendChild(input);
      const b=document.createElement('button');b.type='button';b.className='sg-password-eye';b.setAttribute('aria-label','Show password');b.title='Show password';b.textContent='👁';
      b.onclick=()=>{const hidden=input.type==='password';input.type=hidden?'text':'password';b.setAttribute('aria-label',hidden?'Hide password':'Show password');b.title=hidden?'Hide password':'Show password';b.textContent=hidden?'◉':'👁';};wrap.appendChild(b);
    });
  }
  wirePasswordEyes(); new MutationObserver(()=>wirePasswordEyes()).observe(document.body,{childList:true,subtree:true});

  // Fix quiz creation payload: backend requires totalItems; performance/exam require maxScore.
  if(typeof Teacher!=='undefined' && Teacher.createAssessment){
    Teacher.createAssessment=async function(kind){
      const title=prompt('Assessment title:'); if(!title)return;
      const maximum=Number(prompt(kind==='quizzes'?'Total items:':'Maximum score:','100')); if(!Number.isFinite(maximum)||maximum<=0){Toast?.show?.('Error','Maximum score/total items must be a positive number.','error');return;}
      let examType=null;if(kind==='exams'){examType=prompt('Exam period (Prelim, Midterm, or Final):','Prelim');if(!examType||!examType.trim())return;}
      const endpoint=kind==='quizzes'?'/assessments/quizzes':kind==='performance'?'/assessments/performance-tasks':'/assessments/exams';
      const payload={classId:Teacher.state.classId,title,...(kind==='quizzes'?{totalItems:maximum}:{maxScore:maximum}),...(examType?{examType:examType.trim()}:{})};
      try{await api('POST',endpoint,payload);Toast.show('Created','Assessment created successfully.','success');Teacher.renderAssessment(kind);}catch(e){}
    };
  }

  const defaults=()=>[
    {name:'Attendance',componentKey:'attendance',weight:10,sourceType:'attendance',calculationMethod:'average_percentage',isActive:true,subcomponents:[]},
    {name:'Quizzes',componentKey:'quiz',weight:20,sourceType:'quiz',calculationMethod:'average_percentage',isActive:true,subcomponents:[]},
    {name:'Performance Tasks',componentKey:'performance',weight:30,sourceType:'performance',calculationMethod:'average_percentage',isActive:true,subcomponents:[]},
    {name:'Examination',componentKey:'exam',weight:40,sourceType:'exam',calculationMethod:'average_percentage',isActive:true,subcomponents:[]}
  ];
  let model=null;
  function total(){return (model?.components||[]).filter(c=>c.isActive!==false).reduce((s,c)=>s+Number(c.weight||0),0);}
  function draw(){
    const host=document.getElementById('sg-dynamic-grading');if(!host||!model)return;
    host.innerHTML=`<div class="sg-dg-head"><div><div class="sg-dg-title">Flexible Grading System</div><div class="text-xs text-slate-500">Define the grading components for this class. Active weights must total 100%.</div></div><span class="sg-dg-state">${escHtml(model.state||'draft')}</span></div><div id="sg-dg-components"></div><div class="sg-dg-actions"><button class="sg-dg-btn sg-dg-secondary" data-act="add">+ Add Component</button><span class="sg-dg-total ${Math.abs(total()-100)<.01?'good':'bad'}">Total: ${total()}%</span><button class="sg-dg-btn sg-dg-primary" data-act="save">Save Draft</button>${model.state==='draft'?'<button class="sg-dg-btn sg-dg-primary" data-act="activate">Activate</button>':''}${model.state==='active'?'<button class="sg-dg-btn sg-dg-primary" data-act="finalize">Finalize</button>':''}</div>`;
    const box=host.querySelector('#sg-dg-components');
    model.components.forEach((c,i)=>{const d=document.createElement('div');d.innerHTML=`<div class="sg-dg-row"><input data-i="${i}" data-f="name" value="${escHtml(c.name)}" aria-label="Component name"><input data-i="${i}" data-f="weight" type="number" min="0" max="100" step="0.01" value="${Number(c.weight)}" aria-label="Weight"><select data-i="${i}" data-f="sourceType"><option value="attendance">Attendance</option><option value="quiz">Quiz</option><option value="performance">Performance</option><option value="exam">Exam</option><option value="custom">Custom</option></select><button class="sg-dg-btn sg-dg-danger" data-remove="${i}" title="Remove">×</button></div>${c.sourceType==='exam'?`<div class="sg-dg-sub"><button class="sg-dg-btn sg-dg-secondary" data-exam="${i}">${c.subcomponents?.length?'Reset':'Add'} Prelim / Midterm / Final</button>${(c.subcomponents||[]).map((s,j)=>`<div class="sg-dg-row"><input value="${escHtml(s.name)}" disabled><input data-si="${i}" data-sj="${j}" type="number" min="0" max="100" step="0.01" value="${Number(s.weightShare)}"><span class="text-xs text-slate-500">% of Exam</span></div>`).join('')}</div>`:''}`;d.querySelector('select').value=c.sourceType;box.appendChild(d);});
    host.querySelectorAll('[data-i][data-f]').forEach(el=>el.oninput=()=>{const c=model.components[+el.dataset.i];c[el.dataset.f]=el.dataset.f==='weight'?Number(el.value):el.value;if(el.dataset.f==='sourceType')draw();else{const t=host.querySelector('.sg-dg-total');t.textContent=`Total: ${total()}%`;t.className=`sg-dg-total ${Math.abs(total()-100)<.01?'good':'bad'}`;}});
    host.querySelectorAll('[data-si]').forEach(el=>el.oninput=()=>model.components[+el.dataset.si].subcomponents[+el.dataset.sj].weightShare=Number(el.value));
    host.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{model.components.splice(+b.dataset.remove,1);draw();});
    host.querySelectorAll('[data-exam]').forEach(b=>b.onclick=()=>{model.components[+b.dataset.exam].subcomponents=[{name:'Prelim',weightShare:33.33,sourceFilter:'Prelim',isActive:true},{name:'Midterm',weightShare:33.33,sourceFilter:'Midterm',isActive:true},{name:'Final',weightShare:33.34,sourceFilter:'Final',isActive:true}];draw();});
    host.querySelector('[data-act="add"]').onclick=()=>{model.components.push({name:'New Component',weight:0,sourceType:'custom',calculationMethod:'average_percentage',isActive:true,subcomponents:[]});draw();};
    host.querySelector('[data-act="save"]').onclick=save;
    host.querySelector('[data-act="activate"]')?.addEventListener('click',async()=>{if(await save())await setState('active');});
    host.querySelector('[data-act="finalize"]')?.addEventListener('click',async()=>{if(confirm('Finalize this grading scheme? It will be locked from normal editing.'))await setState('finalized');});
  }
  async function save(){if(Math.abs(total()-100)>.01){Toast.show('Invalid weights',`Weights must total 100%. Current total: ${total()}%.`,'error');return false;}try{const r=await api('PUT',`/grading-schemes/${Teacher.state.classId}`,{name:model.name||'Class Grading Scheme',components:model.components});model=r.scheme;draw();Toast.show('Saved','Grading scheme saved.','success');return true;}catch(e){return false;}}
  async function setState(state){try{const r=await api('POST',`/grading-schemes/${Teacher.state.classId}/state`,{state});model=r.scheme;draw();Toast.show('Updated',`Grading scheme is now ${state}.`,'success');}catch(e){}}
  async function mountBuilder(){
    if(typeof Teacher==='undefined'||!Teacher.state?.classId)return;
    const tab=document.getElementById('teacher-tab-content');if(!tab||document.getElementById('sg-dynamic-grading'))return;
    const host=document.createElement('div');host.id='sg-dynamic-grading';host.className='sg-dg-panel';tab.prepend(host);host.innerHTML='<div class="text-sm font-bold text-slate-500">Loading grading system…</div>';
    try{let r=await api('GET',`/grading-schemes/${Teacher.state.classId}`);if(!r.scheme)r=await api('POST',`/grading-schemes/${Teacher.state.classId}/initialize`,{});model=r.scheme||{state:'draft',components:defaults()};draw();}catch(e){host.innerHTML='<div class="text-sm font-bold text-amber-700">Dynamic grading setup will become available after its database migration is installed.</div>';}
  }
  if(typeof Teacher!=='undefined'){
    const original=Teacher.renderGradebook?.bind(Teacher);if(original)Teacher.renderGradebook=async function(){await original();await mountBuilder();};
  }
})();
