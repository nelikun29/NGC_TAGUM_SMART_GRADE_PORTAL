// NDC Smart Grade Portal — prototype design implementation layer.
// Presentation/UX only. Existing auth, API, grading, attendance, approvals,
// account integrity, database and server behavior remain authoritative.
(() => {
  const param = new URLSearchParams(window.location.search).get('prototypeUI');
  if (String(param || '').toLowerCase() === 'off') {
    console.info('[Prototype UI] Disabled by URL parameter.');
    return;
  }

  const STYLE_ID = 'sg-prototype-ui-theme';
  const ADMIN_RAIL_ID = 'sg-admin-rail';

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root{
        --ndc-navy:#0b2457;
        --ndc-navy-2:#173a73;
        --ndc-blue:#2563eb;
        --ndc-gold:#d6aa32;
        --ndc-canvas:#f5f7fb;
        --ndc-surface:#ffffff;
        --ndc-soft:#f8fafc;
        --ndc-border:#dce4ee;
        --ndc-text:#172033;
        --ndc-muted:#64748b;
        --ndc-success-bg:#ecfdf3;
        --ndc-success:#14804a;
        --ndc-warning-bg:#fff7df;
        --ndc-warning:#9a6b08;
        --ndc-danger-bg:#fff0f0;
        --ndc-danger:#b4232b;
        --ndc-info-bg:#eef4ff;
        --ndc-shadow:0 10px 28px rgba(15,35,75,.07);
      }

      body{
        color:var(--ndc-text);
      }

      /* ---------- shared surfaces ---------- */
      #student-section:not(.hidden),
      #teacher-section:not(.hidden),
      #admin-section:not(.hidden){
        color:var(--ndc-text)!important;
      }
      body:has(#student-section:not(.hidden)),
      body:has(#teacher-section:not(.hidden)),
      body:has(#admin-section:not(.hidden)){
        background:var(--ndc-canvas)!important;
        background-attachment:initial!important;
      }
      #student-section .glass-card,
      #admin-section .glass-card{
        background:var(--ndc-surface)!important;
        border:1px solid var(--ndc-border)!important;
        box-shadow:var(--ndc-shadow)!important;
        backdrop-filter:none!important;
        -webkit-backdrop-filter:none!important;
      }
      #student-section .glass-card:hover,
      #admin-section .glass-card:hover{
        transform:none!important;
      }

      /* ---------- header ---------- */
      body:has(#teacher-section:not(.hidden)) .portal-header,
      body:has(#admin-section:not(.hidden)) .portal-header{
        background:rgba(255,255,255,.97)!important;
        color:var(--ndc-text)!important;
        border-bottom:1px solid var(--ndc-border)!important;
        box-shadow:0 8px 24px rgba(15,35,75,.055)!important;
      }
      body:has(#teacher-section:not(.hidden)) .portal-header h1,
      body:has(#admin-section:not(.hidden)) .portal-header h1,
      body:has(#teacher-section:not(.hidden)) #institution-name-header,
      body:has(#admin-section:not(.hidden)) #institution-name-header{
        color:var(--ndc-navy)!important;
      }
      body:has(#teacher-section:not(.hidden)) .portal-header h1 span,
      body:has(#admin-section:not(.hidden)) .portal-header h1 span{
        color:var(--ndc-gold)!important;
      }
      body:has(#teacher-section:not(.hidden)) .portal-header .header-glow,
      body:has(#admin-section:not(.hidden)) .portal-header .header-glow{
        display:none!important;
      }

      body:has(#student-section:not(.hidden)) .portal-header{
        background:var(--ndc-navy)!important;
        box-shadow:0 8px 24px rgba(11,36,87,.16)!important;
      }
      body:has(#student-section:not(.hidden)) .portal-header .header-glow{
        opacity:.16!important;
      }

      body:has(#student-section:not(.hidden)) #user-header-profile,
      body:has(#teacher-section:not(.hidden)) #user-header-profile,
      body:has(#admin-section:not(.hidden)) #user-header-profile{
        box-shadow:none!important;
      }

      /* ---------- auth ---------- */
      #auth-section .auth-shell{
        border-radius:24px!important;
        overflow:hidden;
        box-shadow:0 24px 64px rgba(15,35,75,.12)!important;
      }
      #auth-section .auth-brand{
        background:var(--ndc-navy)!important;
      }
      #auth-section .auth-brand::before,
      #auth-section .auth-brand::after{
        opacity:.45;
      }
      #auth-section .glass-card{
        background:#fff!important;
        border:1px solid var(--ndc-border)!important;
        box-shadow:none!important;
        backdrop-filter:none!important;
      }
      #auth-section input,
      #auth-section select{
        background:#fff!important;
        border-color:#ccd7e5!important;
        border-radius:10px!important;
      }
      #auth-section .primary-action{
        background:var(--ndc-navy)!important;
        box-shadow:none!important;
      }

      /* ---------- student dashboard ---------- */
      #student-section:not(.hidden){
        display:grid!important;
        grid-template-columns:320px minmax(0,1fr);
        gap:24px;
        align-items:start;
      }
      #student-section > .grid{
        display:contents!important;
      }
      #student-section > .grid > .glass-card{
        grid-column:1;
        position:sticky;
        top:96px;
        border-radius:18px!important;
        padding:22px!important;
      }
      #student-section > .grid > .lg\\:col-span-2{
        grid-column:2;
        min-width:0;
      }
      #student-section > .grid > .lg\\:col-span-2 > h3{
        color:#fff!important;
        font-size:1.55rem!important;
        font-weight:900!important;
        letter-spacing:-.025em!important;
        margin:2px 0 8px!important;
        text-shadow:0 1px 2px rgba(0,0,0,.12)!important;
      }
      #student-section > .grid > .lg\\:col-span-2{
        color:#fff!important;
      }
      #student-section > .grid > .lg\\:col-span-2 > p{
        color:rgba(255,255,255,.88)!important;
        font-size:.95rem!important;
        margin:0 0 16px!important;
      }
      #student-section .student-class-card-grid{
        display:grid!important;
        grid-template-columns:minmax(0,1fr)!important;
        gap:18px!important;
      }
      #student-section .student-class-card-grid > .glass-card{
        border-radius:18px!important;
        overflow:hidden!important;
        box-shadow:var(--ndc-shadow)!important;
      }
      #student-section .student-class-card-grid > .glass-card > div:first-child{
        background:var(--ndc-navy)!important;
        color:#fff!important;
        border:0!important;
      }
      #student-section .student-class-card-grid > .glass-card > div:first-child h4,
      #student-section .student-class-card-grid > .glass-card > div:first-child p{
        color:inherit!important;
      }
      #student-section .student-class-card-grid .text-emerald-700{
        color:var(--ndc-success)!important;
      }
      #student-section button{
        border-radius:10px!important;
      }
      #student-section button.bg-eduBlue-600,
      #student-section button.bg-slate-900{
        background:var(--ndc-navy)!important;
      }
      #student-section button.bg-eduYellow-500{
        background:var(--ndc-gold)!important;
        color:var(--ndc-navy)!important;
      }
      #student-section input{
        border-radius:10px!important;
      }

      /* ---------- admin shell ---------- */
      #admin-section.sg-prototype-admin-active:not(.hidden){
        display:grid!important;
        grid-template-columns:220px minmax(0,1fr);
        gap:22px;
        align-items:start;
      }
      #admin-section.sg-prototype-admin-active > :not(#${ADMIN_RAIL_ID}){
        grid-column:2;
        min-width:0;
      }
      #admin-section.sg-prototype-admin-active > div:first-of-type{
        margin-top:4px;
      }
      #admin-section.sg-prototype-admin-active > div:nth-of-type(2){
        display:none!important;
      }
      #admin-tab-content{
        border:1px solid var(--ndc-border);
        border-radius:18px;
        background:#fff;
        box-shadow:var(--ndc-shadow);
        padding:18px;
        min-height:520px;
      }
      #admin-tab-content h2,
      #admin-tab-content h3,
      #admin-tab-content h4{
        color:var(--ndc-navy)!important;
      }
      #admin-tab-content input,
      #admin-tab-content select,
      #admin-tab-content textarea{
        border-color:#ccd7e5!important;
        border-radius:10px!important;
        background:#fff!important;
      }

      #${ADMIN_RAIL_ID}{
        grid-column:1!important;
        grid-row:1 / span 20!important;
        position:sticky;
        top:96px;
        min-height:620px;
        border-radius:20px;
        overflow:hidden;
        background:var(--ndc-navy);
        color:#fff;
        border:1px solid #15376d;
        box-shadow:0 20px 44px rgba(11,36,87,.15);
      }
      .ndc-admin-rail-head{
        padding:20px 18px 16px;
        border-bottom:1px solid rgba(255,255,255,.1);
      }
      .ndc-admin-rail-head strong{
        display:block;
        font-size:.82rem;
      }
      .ndc-admin-rail-head span{
        display:block;
        margin-top:3px;
        font-size:.66rem;
        color:#afbdd8;
      }
      .ndc-admin-nav{
        padding:14px 10px;
        display:flex;
        flex-direction:column;
        gap:5px;
      }
      .ndc-admin-nav button{
        width:100%;
        min-height:42px;
        display:flex;
        align-items:center;
        gap:10px;
        padding:10px 12px;
        border-radius:11px;
        color:#cbd6eb;
        background:transparent;
        border:1px solid transparent;
        font-size:.75rem;
        font-weight:800;
        text-align:left;
        transform:none!important;
        filter:none!important;
      }
      .ndc-admin-nav button i{
        width:17px;
        text-align:center;
      }
      .ndc-admin-nav button:hover{
        background:rgba(255,255,255,.07)!important;
        color:#fff!important;
      }
      .ndc-admin-nav button.active{
        background:rgba(214,170,50,.14)!important;
        color:#fff!important;
        box-shadow:inset 3px 0 0 var(--ndc-gold);
        border-color:rgba(214,170,50,.14)!important;
      }
      .ndc-admin-rail-foot{
        margin:8px 12px 14px;
        padding:12px;
        border:1px solid rgba(255,255,255,.1);
        border-radius:13px;
        color:#8fa3c9;
        font-size:.62rem;
        line-height:1.45;
      }

      /* ---------- gradebook ---------- */
      #teacher-tab-content > .space-y-4 > div:first-child{
        gap:12px!important;
      }
      #teacher-grade-filter{
        border-radius:10px!important;
        border-color:#ccd7e5!important;
        background:#fff!important;
      }
      #teacher-grade-table{
        border-collapse:separate!important;
        border-spacing:0!important;
      }
      #teacher-grade-table thead th{
        background:#f4f7fb!important;
        color:#52627b!important;
        font-weight:850!important;
      }
      #teacher-grade-table tbody tr:nth-child(even) td{
        background:#fbfcfe!important;
      }
      #teacher-grade-table tbody td{
        color:#334155!important;
      }
      #teacher-grade-table tbody td:last-child{
        white-space:nowrap;
      }

      /* ---------- modal unification ---------- */
      [id$="-modal"] > div.relative,
      [id$="-modal"] > div:not(.absolute):not([data-close-reset]){
        border-radius:18px!important;
      }
      #teacher-adjustment-modal .bg-slate-800,
      #student-edit-profile-modal .bg-slate-800,
      #teacher-class-modal .bg-slate-800{
        background:var(--ndc-navy)!important;
      }

      /* ---------- restrained motion ---------- */
      #student-section .glass-card,
      #admin-section .glass-card,
      #teacher-section .glass-card{
        transition:border-color .16s ease,box-shadow .16s ease,background-color .16s ease!important;
      }

      /* ---------- tablet/mobile ---------- */
      @media(max-width:1100px){
        #student-section:not(.hidden){
          grid-template-columns:280px minmax(0,1fr);
        }
        #admin-section.sg-prototype-admin-active:not(.hidden){
          grid-template-columns:190px minmax(0,1fr);
        }
      }
      @media(max-width:820px){
        #student-section:not(.hidden){
          display:block!important;
        }
        #student-section > .grid{
          display:grid!important;
          grid-template-columns:1fr!important;
        }
        #student-section > .grid > .glass-card{
          position:static;
          margin-bottom:16px;
        }
        #student-section > .grid > .lg\\:col-span-2{
          grid-column:1;
        }

        #admin-section.sg-prototype-admin-active:not(.hidden){
          display:block!important;
        }
        #${ADMIN_RAIL_ID}{
          position:static;
          min-height:0;
          margin-bottom:14px;
          border-radius:15px;
        }
        .ndc-admin-rail-head,
        .ndc-admin-rail-foot{
          display:none;
        }
        .ndc-admin-nav{
          flex-direction:row;
          overflow-x:auto;
          padding:8px;
        }
        .ndc-admin-nav button{
          width:auto;
          white-space:nowrap;
          min-height:38px;
        }
        #admin-section.sg-prototype-admin-active > :not(#${ADMIN_RAIL_ID}){
          grid-column:auto;
        }
      }
      @media(max-width:560px){
        body:has(#student-section:not(.hidden)) #user-header-profile,
        body:has(#teacher-section:not(.hidden)) #user-header-profile,
        body:has(#admin-section:not(.hidden)) #user-header-profile{
          max-width:170px;
        }
        #student-section > .grid > .glass-card{
          padding:16px!important;
        }
        #student-section > .grid > .lg\\:col-span-2 > h3{
          font-size:1.28rem!important;
        }
        #teacher-grade-table{
          min-width:860px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const ADMIN_NAV = [
    {tab:'dashboard', label:'Dashboard', icon:'fa-chart-pie'},
    {tab:'approvals', label:'Approvals', icon:'fa-user-check'},
    {tab:'users', label:'Users', icon:'fa-users'},
    {tab:'classes', label:'Classes', icon:'fa-chalkboard'},
    {tab:'audit-log', label:'Audit Log', icon:'fa-clipboard-list'}
  ];

  function adminButton(item){
    return `<button type="button" data-admin-tab="${item.tab}" onclick="Admin.switchTab('${item.tab}')">
      <i class="fa-solid ${item.icon}"></i><span>${item.label}</span>
    </button>`;
  }

  function buildAdminRail(section){
    if(document.getElementById(ADMIN_RAIL_ID)) return;
    const rail=document.createElement('aside');
    rail.id=ADMIN_RAIL_ID;
    rail.innerHTML=`
      <div class="ndc-admin-rail-head">
        <strong>Admin Workspace</strong>
        <span>System Management</span>
      </div>
      <nav class="ndc-admin-nav">${ADMIN_NAV.map(adminButton).join('')}</nav>
      <div class="ndc-admin-rail-foot">
        Account, enrollment and audit controls continue to use the existing server-backed workflows.
      </div>
    `;
    section.prepend(rail);
  }

  function syncAdminRail(){
    const section=document.getElementById('admin-section');
    if(!section || section.classList.contains('hidden')) return;
    section.classList.add('sg-prototype-admin-active');
    buildAdminRail(section);
    const current=(window.Admin && Admin.tab) || 'dashboard';
    section.querySelectorAll('#'+ADMIN_RAIL_ID+' [data-admin-tab]').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.adminTab===current);
    });
  }

  function decorateRole(){
    const role=window.Store?.user?.role;
    if(role==='admin') syncAdminRail();
  }

  let queued=false;
  function queue(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      decorateRole();
    });
  }

  const observer=new MutationObserver(queue);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('load',queue);

  // Keep Admin rail state synchronized after the existing tab handler runs.
  const patchAdminSwitch=()=>{
    if(!window.Admin || typeof Admin.switchTab!=='function' || Admin.switchTab.__prototypePatched) return;
    const original=Admin.switchTab.bind(Admin);
    const patched=function(tab){
      const result=original(tab);
      requestAnimationFrame(syncAdminRail);
      return result;
    };
    patched.__prototypePatched=true;
    Admin.switchTab=patched;
  };

  const patchTimer=setInterval(()=>{
    patchAdminSwitch();
    if(window.Admin && typeof Admin.switchTab==='function' && Admin.switchTab.__prototypePatched){
      clearInterval(patchTimer);
      queue();
    }
  },100);
})();
