// Focus Rail UI — presentation layer only.
// No API, authentication, grading, permissions, database, or Netlify behavior is changed.
(() => {
  const STYLE_ID = 'sg-focus-rail-theme';
  const RAIL_ID = 'sg-focus-rail';
  const MOBILE_ID = 'sg-focus-mobile-nav';

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root{
      --fr-navy:#0b2457;
      --fr-navy-2:#13366f;
      --fr-blue:#2563eb;
      --fr-sky:#eaf4ff;
      --fr-gold:#d6aa32;
      --fr-gold-soft:#fff7d6;
      --fr-ink:#172033;
      --fr-muted:#64748b;
      --fr-line:#dbe4ef;
      --fr-surface:#ffffff;
      --fr-canvas:#f5f8fc;
      --fr-shadow:0 14px 34px rgba(15,35,75,.08);
      --fr-shadow-lg:0 24px 60px rgba(15,35,75,.12);
    }

    body:has(#teacher-section:not(.hidden)){background:var(--fr-canvas)!important;background-attachment:initial!important}
    body:has(#teacher-section:not(.hidden)) .portal-header{
      background:rgba(255,255,255,.96)!important;
      color:var(--fr-ink)!important;
      border-bottom:1px solid var(--fr-line)!important;
      box-shadow:0 8px 24px rgba(15,35,75,.06)!important;
      backdrop-filter:blur(18px);
    }
    body:has(#teacher-section:not(.hidden)) .portal-header .header-glow{display:none!important}
    body:has(#teacher-section:not(.hidden)) .portal-header #institution-name-header{color:var(--fr-navy)!important}
    body:has(#teacher-section:not(.hidden)) .portal-header h1{color:var(--fr-navy)!important}
    body:has(#teacher-section:not(.hidden)) .portal-header h1 span{color:var(--fr-gold)!important}
    body:has(#teacher-section:not(.hidden)) .portal-header p.text-blue-200{color:#71809b!important}
    body:has(#teacher-section:not(.hidden)) #user-header-profile{
      background:#f8fafc!important;border-color:var(--fr-line)!important;color:var(--fr-ink)!important
    }
    body:has(#teacher-section:not(.hidden)) #user-header-profile>div:first-child{
      background:var(--fr-gold-soft)!important;color:var(--fr-navy)!important
    }
    body:has(#teacher-section:not(.hidden)) #user-role-badge{
      background:#eaf2ff!important;color:var(--fr-navy)!important
    }
    body:has(#teacher-section:not(.hidden)) .notification-btn{
      background:#f8fafc!important;border-color:var(--fr-line)!important;color:var(--fr-navy)!important
    }

    #teacher-section::before,#teacher-section::after{display:none!important}
    #teacher-section{color:var(--fr-ink)!important}
    #teacher-section.sg-focus-rail-active:not(.hidden){
      display:grid!important;
      grid-template-columns:232px minmax(0,1fr);
      gap:22px;
      align-items:start;
    }
    #teacher-section.sg-focus-rail-active>.space-y-6{min-width:0;margin:0!important}
    #teacher-section.sg-focus-rail-active .sg-ref-heading,
    #teacher-section.sg-focus-rail-active .sg-ref-heading h2,
    #teacher-section.sg-focus-rail-active .sg-ref-heading h3{color:var(--fr-navy)!important}
    #teacher-section.sg-focus-rail-active .sg-ref-heading::before{display:none!important}

    #${RAIL_ID}{
      position:sticky;
      top:96px;
      z-index:25;
      border:1px solid #15376d;
      border-radius:22px;
      overflow:hidden;
      background:linear-gradient(180deg,#0b2457 0%,#0a1d45 100%);
      box-shadow:0 22px 48px rgba(9,29,69,.18);
      color:#fff;
      min-height:620px;
    }
    .fr-brand{
      padding:20px 18px 16px;
      border-bottom:1px solid rgba(255,255,255,.10);
    }
    .fr-brand-row{display:flex;align-items:center;gap:11px}
    .fr-brand img{width:38px;height:38px;border-radius:50%;background:#fff;object-fit:contain;box-shadow:0 0 0 2px rgba(214,170,50,.45)}
    .fr-brand strong{display:block;font-size:.78rem;letter-spacing:.02em}
    .fr-brand span{display:block;margin-top:2px;font-size:.65rem;color:#aebddd}
    .fr-section-label{
      padding:17px 18px 8px;
      font-size:.59rem;
      text-transform:uppercase;
      letter-spacing:.14em;
      font-weight:800;
      color:#8095bd;
    }
    .fr-nav{padding:0 10px 12px;display:flex;flex-direction:column;gap:5px}
    .fr-nav button{
      width:100%;min-height:42px;
      display:flex;align-items:center;gap:11px;
      border-radius:12px;padding:10px 12px;
      color:#c9d5ec;text-align:left;font-size:.77rem;font-weight:750;
      border:1px solid transparent;background:transparent;
      transform:none!important;filter:none!important;
    }
    .fr-nav button i{width:18px;text-align:center;font-size:.78rem}
    .fr-nav button:hover{background:rgba(255,255,255,.07)!important;color:#fff!important}
    .fr-nav button.active{
      color:#fff!important;
      background:linear-gradient(90deg,rgba(214,170,50,.22),rgba(214,170,50,.09))!important;
      border-color:rgba(246,214,111,.16)!important;
      box-shadow:inset 3px 0 0 var(--fr-gold);
    }
    .fr-nav button.active i{color:#f5cf68}
    .fr-rail-foot{
      margin:8px 12px 14px;
      border:1px solid rgba(255,255,255,.10);
      border-radius:14px;padding:12px;
      background:rgba(255,255,255,.045);
    }
    .fr-rail-foot p{margin:0;color:#8ea2c8;font-size:.63rem;line-height:1.45}
    .fr-rail-foot strong{display:block;color:#fff;font-size:.70rem;margin-bottom:3px}

    #teacher-section.sg-focus-rail-active .glass-card,
    #teacher-section.sg-focus-rail-active article{
      background:var(--fr-surface)!important;
      border:1px solid var(--fr-line)!important;
      color:var(--fr-ink)!important;
      box-shadow:var(--fr-shadow)!important;
      backdrop-filter:none!important;
      -webkit-backdrop-filter:none!important;
    }
    #teacher-section.sg-focus-rail-active article:hover{
      transform:translateY(-2px)!important;border-color:#bdd1ed!important;box-shadow:var(--fr-shadow-lg)!important
    }
    #teacher-section.sg-focus-rail-active article>div:first-child{
      background:#fff!important;border-bottom:1px solid var(--fr-line)!important
    }
    #teacher-section.sg-focus-rail-active article h4,
    #teacher-section.sg-focus-rail-active article p,
    #teacher-section.sg-focus-rail-active article code{color:inherit!important}
    #teacher-section.sg-focus-rail-active article button[onclick*="selectClass"]{
      background:var(--fr-navy)!important;color:#fff!important;box-shadow:none!important
    }
    #teacher-section.sg-focus-rail-active article button[onclick*="editClass"]{
      background:#f8fafc!important;border-color:var(--fr-line)!important;color:var(--fr-navy)!important
    }

    #teacher-section.sg-focus-rail-active .sg-ref-selected{
      background:#fff!important;border:1px solid var(--fr-line)!important;
      border-left:5px solid var(--fr-gold)!important;
      box-shadow:var(--fr-shadow)!important;
    }
    #teacher-section.sg-focus-rail-active .sg-ref-selected::before,
    #teacher-section.sg-focus-rail-active .sg-ref-selected::after{display:none!important}
    #teacher-section.sg-focus-rail-active .sg-ref-selected h2,
    #teacher-section.sg-focus-rail-active .sg-ref-selected h3,
    #teacher-section.sg-focus-rail-active .sg-ref-selected h4,
    #teacher-section.sg-focus-rail-active .sg-ref-selected #teacher-selected-class-name{color:var(--fr-navy)!important}
    #teacher-section.sg-focus-rail-active .sg-ref-selected p,
    #teacher-section.sg-focus-rail-active .sg-ref-selected label{color:var(--fr-muted)!important}
    #teacher-section.sg-focus-rail-active .sg-ref-selected select{
      background:#fff!important;border:1px solid var(--fr-line)!important;color:var(--fr-ink)!important
    }

    #teacher-section.sg-focus-rail-active .sg-ref-tabs{
      background:#fff!important;border:1px solid var(--fr-line)!important;
      border-radius:18px 18px 0 0!important;
      box-shadow:none!important;
      padding:7px 8px 0!important;
    }
    #teacher-section.sg-focus-rail-active .tab-btn{
      color:#64748b!important;background:transparent!important;border-radius:10px 10px 0 0!important;font-weight:750!important
    }
    #teacher-section.sg-focus-rail-active .tab-btn:hover{color:var(--fr-navy)!important;background:#f5f8fc!important;transform:none!important}
    #teacher-section.sg-focus-rail-active .tab-btn.active{color:var(--fr-navy)!important;background:#eef4fc!important}
    #teacher-section.sg-focus-rail-active .tab-btn.active::after{
      left:18%!important;right:18%!important;height:3px!important;background:var(--fr-gold)!important;box-shadow:none!important
    }

    #teacher-tab-content{
      background:#fff!important;color:var(--fr-ink)!important;
      border:1px solid var(--fr-line)!important;border-top:0!important;
      border-radius:0 0 18px 18px!important;
      box-shadow:var(--fr-shadow)!important;
      backdrop-filter:none!important;
    }
    #teacher-tab-content h2,#teacher-tab-content h3,#teacher-tab-content h4{color:var(--fr-navy)!important}
    #teacher-tab-content .glass-card{
      background:#fff!important;border:1px solid var(--fr-line)!important;box-shadow:none!important;border-radius:15px!important
    }
    #teacher-tab-content input,#teacher-tab-content select,#teacher-tab-content textarea{
      background:#fff!important;color:var(--fr-ink)!important;border-color:#cbd8e7!important;border-radius:10px!important
    }
    #teacher-tab-content input:focus,#teacher-tab-content select:focus,#teacher-tab-content textarea:focus{
      border-color:#86a9d8!important;box-shadow:0 0 0 3px rgba(37,99,235,.09)!important
    }

    #teacher-grade-table{
      border-collapse:separate!important;border-spacing:0!important;
      min-width:930px;background:#fff!important;border:0!important;box-shadow:none!important
    }
    #teacher-grade-table thead th{
      position:sticky;top:0;z-index:2;
      background:#f4f7fb!important;color:#40516f!important;
      font-size:.64rem!important;letter-spacing:.055em!important;text-transform:uppercase!important;
      border-bottom:1px solid var(--fr-line)!important;
      padding:.78rem .72rem!important;
    }
    #teacher-grade-table tbody td{
      padding:.80rem .72rem!important;border-bottom:1px solid #edf1f6!important;
      font-size:.76rem!important;color:#334155!important;vertical-align:middle
    }
    #teacher-grade-table tbody tr:hover{background:#f8fbff!important}
    #teacher-grade-table tbody tr td:first-child{font-weight:800!important;color:var(--fr-navy)!important;min-width:180px}
    #teacher-grade-table button{color:var(--fr-blue)!important}
    #teacher-grade-table span.text-emerald-600{background:#ecfdf3;color:#14804a!important;padding:4px 7px;border-radius:999px}
    #teacher-grade-table span.text-amber-600{background:#fff7df;color:#9a6b08!important;padding:4px 7px;border-radius:999px}

    .fr-grade-toolbar{
      display:flex!important;align-items:center!important;justify-content:space-between!important;
      gap:12px!important;padding:2px 0 2px!important
    }
    #teacher-grade-filter{min-width:220px!important;background:#f8fafc!important}
    #teacher-tab-content button[onclick="Teacher.downloadFinalGrades()"]{
      background:var(--fr-navy)!important;color:#fff!important;box-shadow:none!important;border-radius:10px!important
    }

    #${MOBILE_ID}{
      display:none;position:sticky;top:70px;z-index:26;
      margin-bottom:14px;padding:8px;
      background:rgba(255,255,255,.96);border:1px solid var(--fr-line);border-radius:15px;
      box-shadow:0 10px 28px rgba(15,35,75,.08);overflow-x:auto;gap:6px;
    }
    #${MOBILE_ID} button{
      white-space:nowrap;min-height:38px;padding:8px 11px;border-radius:10px;
      font-size:.70rem;font-weight:800;color:#52627e;background:#f8fafc;border:1px solid #e6edf5
    }
    #${MOBILE_ID} button.active{background:var(--fr-navy)!important;color:#fff!important;border-color:var(--fr-navy)!important}

    @media(max-width:1024px){
      #teacher-section.sg-focus-rail-active:not(.hidden){display:block!important}
      #${RAIL_ID}{display:none!important}
      #${MOBILE_ID}{display:flex}
    }
    @media(max-width:640px){
      body:has(#teacher-section:not(.hidden)) main{padding-left:10px!important;padding-right:10px!important}
      #teacher-section.sg-focus-rail-active .sg-ref-selected{border-left-width:4px!important}
      #teacher-tab-content{padding:14px!important}
      #teacher-grade-filter{min-width:0!important;width:100%!important}
      #teacher-tab-content>div>div:first-child{align-items:stretch!important}
    }
    @media print{
      #${RAIL_ID},#${MOBILE_ID}{display:none!important}
      #teacher-section.sg-focus-rail-active:not(.hidden){display:block!important}
    }
  `;
  document.head.appendChild(style);

  const NAV = [
    { key:'classes', label:'Classes', icon:'fa-layer-group' },
    { key:'students', label:'Students', icon:'fa-users' },
    { key:'attendance', label:'Attendance', icon:'fa-calendar-check' },
    { key:'gradebook', label:'Gradebook', icon:'fa-table-list' },
    { key:'quizzes', label:'Assessments', icon:'fa-clipboard-check' },
    { key:'approvals', label:'Approvals', icon:'fa-user-check' },
    { key:'weights', label:'Settings', icon:'fa-sliders' }
  ];

  function selectedClassName(){
    try { return Teacher?.getSelectedClass?.()?.subject || 'Teacher Workspace'; }
    catch { return 'Teacher Workspace'; }
  }

  function navButton(item, mobile=false){
    const active = activeKey() === item.key;
    return `<button type="button" data-fr-key="${item.key}" class="${active?'active':''}" aria-current="${active?'page':'false'}">
      <i class="fa-solid ${item.icon}"></i><span>${item.label}</span>
    </button>`;
  }

  function activeKey(){
    if (typeof Teacher === 'undefined') return 'classes';
    const tab = Teacher.state?.tab || 'gradebook';
    return tab;
  }

  function performNav(key){
    if (typeof Teacher === 'undefined') return;
    if (key === 'classes') {
      Teacher.render().then?.(() => {
        document.getElementById('teacher-section')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
      return;
    }
    const tab = key === 'students' ? 'students' : key;
    if (typeof Teacher.switchTab === 'function') Teacher.switchTab(tab);
    setTimeout(() => {
      document.getElementById('teacher-tab-content')?.scrollIntoView({behavior:'smooth',block:'start'});
      syncActive();
    }, 0);
  }

  function buildRail(section){
    if (!section || section.querySelector('#'+RAIL_ID)) return;
    const aside = document.createElement('aside');
    aside.id = RAIL_ID;
    aside.setAttribute('aria-label','Teacher workspace navigation');
    aside.innerHTML = `
      <div class="fr-brand">
        <div class="fr-brand-row">
          <img src="./assets/logo.png" alt="">
          <div><strong>NDC Academic Portal</strong><span>Teacher Workspace</span></div>
        </div>
      </div>
      <div class="fr-section-label">Workspace</div>
      <nav class="fr-nav">${NAV.map(x=>navButton(x)).join('')}</nav>
      <div class="fr-rail-foot"><strong id="fr-current-class">${selectedClassName()}</strong><p>Focus Rail organizes the existing portal without changing academic records or grade logic.</p></div>
    `;
    aside.addEventListener('click',e=>{
      const btn=e.target.closest('button[data-fr-key]');
      if(btn) performNav(btn.dataset.frKey);
    });
    section.prepend(aside);
  }

  function buildMobile(section){
    if (!section || section.querySelector('#'+MOBILE_ID)) return;
    const nav=document.createElement('nav');
    nav.id=MOBILE_ID;
    nav.setAttribute('aria-label','Teacher workspace mobile navigation');
    nav.innerHTML=NAV.map(x=>navButton(x,true)).join('');
    nav.addEventListener('click',e=>{
      const btn=e.target.closest('button[data-fr-key]');
      if(btn) performNav(btn.dataset.frKey);
    });
    const root=section.querySelector(':scope > .space-y-6');
    if(root) root.prepend(nav); else section.prepend(nav);
  }

  function decorateGradebook(){
    const table=document.getElementById('teacher-grade-table');
    if(!table) return;
    const wrapper=table.parentElement;
    if(wrapper){
      wrapper.style.border='1px solid var(--fr-line)';
      wrapper.style.borderRadius='14px';
      wrapper.style.overflow='auto';
      wrapper.style.boxShadow='none';
    }
    const toolbar=table.closest('.space-y-4')?.firstElementChild;
    if(toolbar) toolbar.classList.add('fr-grade-toolbar');
  }

  function decorateTeacher(){
    const section=document.getElementById('teacher-section');
    if(!section || section.classList.contains('hidden')) return;
    section.classList.add('sg-focus-rail-active');
    buildRail(section);
    buildMobile(section);
    const selected=document.getElementById('teacher-selected-class-name');
    selected?.closest('.glass-card')?.classList.add('sg-ref-selected');
    const tabContent=document.getElementById('teacher-tab-content');
    tabContent?.previousElementSibling?.classList.add('sg-ref-tabs');
    decorateGradebook();
    const current=document.getElementById('fr-current-class');
    if(current) current.textContent=selectedClassName();
    syncActive();
  }

  function syncActive(){
    const key=activeKey();
    document.querySelectorAll('[data-fr-key]').forEach(btn=>{
      const on=btn.dataset.frKey===key;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-current',on?'page':'false');
    });
  }

  let queued=false;
  function queueDecorate(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;decorateTeacher();});
  }

  document.addEventListener('DOMContentLoaded',queueDecorate);
  document.addEventListener('click',e=>{
    if(e.target.closest('#teacher-section .tab-btn')) setTimeout(syncActive,0);
  });

  new MutationObserver(queueDecorate).observe(document.body,{childList:true,subtree:true});

  const wait=setInterval(()=>{
    if(typeof Teacher!=='undefined'){
      clearInterval(wait);
      queueDecorate();
    }
  },120);
  setTimeout(()=>clearInterval(wait),12000);
})();