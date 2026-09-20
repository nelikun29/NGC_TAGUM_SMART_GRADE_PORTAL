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

    /* =========================================================
       FOCUS RAIL — PHASE 2 WORKSPACE REFINEMENT
       ========================================================= */
    .fr-workspace-masthead{
      position:relative;overflow:hidden;
      display:flex;align-items:flex-start;justify-content:space-between;gap:18px;
      padding:22px 24px;
      border:1px solid var(--fr-line);border-radius:20px;
      background:linear-gradient(135deg,#ffffff 0%,#f8fbff 62%,#fffaf0 100%);
      box-shadow:var(--fr-shadow);
    }
    .fr-workspace-masthead::after{
      content:"";position:absolute;right:-55px;top:-75px;width:190px;height:190px;border-radius:50%;
      background:radial-gradient(circle,rgba(214,170,50,.13),transparent 68%);pointer-events:none;
    }
    .fr-kicker{font-size:.61rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#7a8ba6}
    .fr-workspace-title{margin-top:5px;font-size:1.48rem;line-height:1.15;font-weight:900;letter-spacing:-.028em;color:var(--fr-navy)}
    .fr-workspace-subtitle{margin-top:6px;max-width:680px;font-size:.76rem;line-height:1.55;color:var(--fr-muted)}
    .fr-masthead-actions{position:relative;z-index:2;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .fr-action-primary,.fr-action-secondary{
      display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:39px;
      padding:9px 12px;border-radius:10px;font-size:.70rem;font-weight:850!important;white-space:nowrap;
      transform:none!important;filter:none!important
    }
    .fr-action-primary{background:var(--fr-navy)!important;color:#fff!important;box-shadow:0 7px 18px rgba(11,36,87,.16)}
    .fr-action-secondary{background:#fff!important;color:var(--fr-navy)!important;border:1px solid var(--fr-line)!important}
    .fr-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .fr-summary-card{
      position:relative;overflow:hidden;min-height:90px;padding:15px 16px;
      border:1px solid var(--fr-line);border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(15,35,75,.055)
    }
    .fr-summary-card::after{
      content:"";position:absolute;right:-26px;bottom:-34px;width:86px;height:86px;border-radius:50%;
      background:#f4f8fd
    }
    .fr-summary-card .fr-stat-icon{
      width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;
      background:#edf4ff;color:var(--fr-navy);font-size:.72rem
    }
    .fr-summary-card.fr-summary-gold .fr-stat-icon{background:var(--fr-gold-soft);color:#8a650c}
    .fr-summary-label{margin-top:10px;font-size:.61rem;font-weight:800;letter-spacing:.055em;text-transform:uppercase;color:#8190a7}
    .fr-summary-value{margin-top:2px;font-size:1.15rem;font-weight:900;color:var(--fr-navy);letter-spacing:-.02em}
    .fr-summary-note{margin-top:1px;font-size:.61rem;color:#94a3b8}
    .fr-rail-badge{
      margin-left:auto;min-width:20px;height:20px;padding:0 6px;border-radius:999px;
      display:inline-flex;align-items:center;justify-content:center;
      background:rgba(255,255,255,.11);color:#dbe7fb;font-size:.57rem;font-weight:900
    }
    .fr-nav button.active .fr-rail-badge{background:rgba(246,214,111,.16);color:#f6d66f}
    .fr-context-line{
      display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px;font-size:.66rem;color:#71809a
    }
    .fr-context-chip{
      display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;
      background:#f3f6fa;border:1px solid #e2e8f0;color:#53627b;font-weight:750
    }
    #teacher-grade-table thead th:first-child,
    #teacher-grade-table tbody td:first-child{
      position:sticky;left:0;z-index:3;background:#fff!important;box-shadow:1px 0 0 #e5ebf3
    }
    #teacher-grade-table thead th:first-child{z-index:5;background:#f4f7fb!important}
    #teacher-grade-table tbody tr:nth-child(even) td{background:#fbfcfe}
    #teacher-grade-table tbody tr:hover td{background:#f5f9ff!important}
    #teacher-grade-table tbody tr:hover td:first-child{background:#f5f9ff!important}
    .fr-grade-meta{
      display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px
    }
    .fr-grade-meta span{
      display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid #e5ebf3;
      border-radius:999px;background:#f8fafc;font-size:.62rem;font-weight:750;color:#66758d
    }
    .fr-grade-meta .fr-grade-count{background:#edf4ff;color:var(--fr-navy);border-color:#d9e7fa}
    .fr-assessment-subnav{
      display:flex;gap:7px;flex-wrap:wrap;padding:10px 0 2px;margin-bottom:8px
    }
    .fr-assessment-subnav button{
      min-height:36px;padding:8px 11px;border-radius:9px;border:1px solid var(--fr-line);
      background:#fff;color:#596984;font-size:.67rem;font-weight:850;transform:none!important;filter:none!important
    }
    .fr-assessment-subnav button.active{background:var(--fr-navy)!important;color:#fff!important;border-color:var(--fr-navy)!important}
    .fr-empty-quiet{
      border:1px dashed #cad6e5;border-radius:14px;padding:22px;text-align:center;background:#fafcff;color:#71809a
    }

    /* =========================================================
       FOCUS RAIL — PHASE 3 VISUAL HARMONIZATION
       ========================================================= */

    #teacher-section.sg-focus-rail-active [data-fr-surface="toolbar"]{
      border:1px solid var(--fr-line)!important;border-radius:14px!important;
      background:#fbfdff!important;padding:12px 14px!important
    }
    #teacher-section.sg-focus-rail-active [data-fr-surface="section-header"]{
      position:relative;padding-left:13px!important
    }
    #teacher-section.sg-focus-rail-active [data-fr-surface="section-header"]::before{
      content:"";position:absolute;left:0;top:3px;bottom:3px;width:3px;border-radius:999px;background:var(--fr-gold)
    }

    #teacher-section.sg-focus-rail-active [data-fr-surface="student-row"]{
      border-color:#e8eef5!important;background:#fff!important;transition:background .16s ease,border-color .16s ease
    }
    #teacher-section.sg-focus-rail-active [data-fr-surface="student-row"]:hover{background:#f8fbff!important}
    #teacher-section.sg-focus-rail-active [data-fr-surface="student-avatar"]{
      background:#edf4ff!important;color:var(--fr-navy)!important;border:1px solid #dce9f8!important
    }

    #teacher-section.sg-focus-rail-active [data-fr-surface="assessment-card"]{
      border:1px solid var(--fr-line)!important;border-left:4px solid #9db4d2!important;
      background:#fff!important;border-radius:15px!important;box-shadow:0 7px 20px rgba(15,35,75,.045)!important
    }
    #teacher-section.sg-focus-rail-active [data-fr-surface="assessment-card"]:has(.bg-emerald-100){
      border-left-color:#4aa376!important
    }
    #teacher-section.sg-focus-rail-active [data-fr-surface="assessment-card"] h5{
      color:var(--fr-navy)!important;font-size:.85rem!important;letter-spacing:-.01em
    }

    #teacher-section.sg-focus-rail-active [data-fr-surface="attendance-card"]{
      border:1px solid var(--fr-line)!important;background:#fff!important;border-radius:15px!important;
      box-shadow:0 7px 20px rgba(15,35,75,.045)!important
    }
    #teacher-section.sg-focus-rail-active [data-fr-surface="attendance-card"]::before{
      content:"";display:block;height:3px;margin:-1rem -1rem .9rem;border-radius:15px 15px 0 0;
      background:linear-gradient(90deg,var(--fr-navy),#4b7dbd)
    }

    #teacher-section.sg-focus-rail-active [data-fr-surface="approval-card"]{
      border:1px solid #eadfb8!important;background:linear-gradient(135deg,#fff 0%,#fffdf7 100%)!important;
      border-radius:15px!important;box-shadow:0 7px 20px rgba(115,83,12,.045)!important
    }
    #teacher-section.sg-focus-rail-active [data-fr-surface="approval-card"] .bg-amber-100{
      background:var(--fr-gold-soft)!important;color:#8d6910!important
    }

    #teacher-section.sg-focus-rail-active [data-fr-surface="settings-panel"]{
      border:1px solid var(--fr-line)!important;border-radius:16px!important;background:#fff!important;
      box-shadow:0 8px 24px rgba(15,35,75,.05)!important
    }
    #teacher-section.sg-focus-rail-active [data-fr-surface="settings-panel"] label{
      color:#4f6079!important;font-size:.72rem!important;font-weight:800!important
    }

    #teacher-section.sg-focus-rail-active button.bg-eduBlue-600,
    #teacher-section.sg-focus-rail-active button.bg-blue-600,
    #teacher-section.sg-focus-rail-active button.bg-blue-700{
      background:var(--fr-navy)!important;color:#fff!important;box-shadow:none!important
    }
    #teacher-section.sg-focus-rail-active button.bg-emerald-600{
      background:#16794d!important;color:#fff!important;box-shadow:none!important
    }
    #teacher-section.sg-focus-rail-active button.bg-slate-100,
    #teacher-section.sg-focus-rail-active button.bg-slate-50{
      background:#f7f9fc!important;border-color:#dfe7f0!important;color:#52627b!important
    }
    #teacher-section.sg-focus-rail-active button.bg-red-50{
      background:#fff6f6!important;border-color:#f2cccc!important;color:#b4232d!important
    }
    #teacher-section.sg-focus-rail-active button:disabled{filter:none!important;transform:none!important}

    #teacher-section.sg-focus-rail-active .bg-amber-50{
      background:#fffaf0!important
    }
    #teacher-section.sg-focus-rail-active .bg-blue-50{
      background:#f1f7ff!important
    }
    #teacher-section.sg-focus-rail-active .bg-slate-50{
      background:#f8fafc!important
    }

    body:has(#teacher-section:not(.hidden)) #teacher-class-modal>div.relative,
    body:has(#teacher-section:not(.hidden)) [id^="teacher-"][id$="-modal"]>div.relative,
    body:has(#teacher-section:not(.hidden)) [id*="adjust"][id$="-modal"]>div,
    body:has(#teacher-section:not(.hidden)) [id*="unfinalize"][id$="-modal"]>div{
      border:1px solid var(--fr-line)!important;border-radius:20px!important;
      box-shadow:0 28px 80px rgba(15,35,75,.20)!important;overflow:hidden!important
    }
    body:has(#teacher-section:not(.hidden)) #teacher-class-modal .bg-slate-800,
    body:has(#teacher-section:not(.hidden)) [id^="teacher-"][id$="-modal"] .bg-slate-800{
      background:linear-gradient(135deg,var(--fr-navy),#153c79)!important
    }
    body:has(#teacher-section:not(.hidden)) #teacher-class-modal form,
    body:has(#teacher-section:not(.hidden)) [id^="teacher-"][id$="-modal"] form{
      background:#fff!important
    }
    body:has(#teacher-section:not(.hidden)) #teacher-class-modal input,
    body:has(#teacher-section:not(.hidden)) #teacher-class-modal select,
    body:has(#teacher-section:not(.hidden)) [id^="teacher-"][id$="-modal"] input,
    body:has(#teacher-section:not(.hidden)) [id^="teacher-"][id$="-modal"] select{
      border-color:#cbd8e7!important;border-radius:10px!important;background:#fff!important
    }
    body:has(#teacher-section:not(.hidden)) #teacher-class-modal input:focus,
    body:has(#teacher-section:not(.hidden)) [id^="teacher-"][id$="-modal"] input:focus{
      border-color:#86a9d8!important;box-shadow:0 0 0 3px rgba(37,99,235,.09)!important
    }

    .fr-section-banner{
      display:flex;align-items:flex-start;justify-content:space-between;gap:14px;
      margin-bottom:14px;padding:14px 16px;border:1px solid var(--fr-line);
      border-radius:14px;background:linear-gradient(135deg,#fbfdff,#f6f9fd)
    }
    .fr-section-banner-icon{
      width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;
      flex:0 0 auto;background:#eaf2ff;color:var(--fr-navy)
    }
    .fr-section-banner-copy{min-width:0;flex:1}
    .fr-section-banner-title{font-size:.82rem;font-weight:900;color:var(--fr-navy)}
    .fr-section-banner-text{margin-top:2px;font-size:.66rem;line-height:1.45;color:#71809a}
    .fr-section-banner-badge{
      flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;padding:5px 8px;
      border-radius:999px;background:#fff;border:1px solid #dfe7f0;color:#60708a;font-size:.60rem;font-weight:850
    }

    .fr-form-grid{
      display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px
    }
    .fr-form-help{
      margin-top:4px;font-size:.61rem;color:#91a0b4;line-height:1.45
    }
    .fr-danger-zone{
      border:1px solid #f0d2d5!important;background:#fff9f9!important;border-radius:14px!important
    }

    @media(max-width:1180px){
      .fr-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media(max-width:1024px){
      #teacher-section.sg-focus-rail-active:not(.hidden){display:block!important}
      #${RAIL_ID}{display:none!important}
      #${MOBILE_ID}{display:flex}
    }
    @media(max-width:760px){
      .fr-workspace-masthead{padding:18px;flex-direction:column}
      .fr-masthead-actions{width:100%;justify-content:flex-start}
      .fr-summary-grid{grid-template-columns:1fr 1fr;gap:9px}
    }
    @media(max-width:640px){
      body:has(#teacher-section:not(.hidden)) main{padding-left:10px!important;padding-right:10px!important}
      #teacher-section.sg-focus-rail-active .sg-ref-selected{border-left-width:4px!important}
      #teacher-tab-content{padding:14px!important}
      #teacher-grade-filter{min-width:0!important;width:100%!important}
      #teacher-tab-content>div>div:first-child{align-items:stretch!important}
      .fr-form-grid{grid-template-columns:1fr}
      .fr-section-banner{align-items:flex-start;flex-wrap:wrap}
      .fr-section-banner-badge{margin-left:44px}
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
    const badge = mobile ? '' : '<span class="fr-rail-badge" data-fr-badge="'+item.key+'" style="display:none"></span>';
    return `<button type="button" data-fr-key="${item.key}" class="${active?'active':''}" aria-current="${active?'page':'false'}">
      <i class="fa-solid ${item.icon}"></i><span>${item.label}</span>${badge}
    </button>`;
  }

  function activeKey(){
    if (typeof Teacher === 'undefined') return 'classes';
    const tab = Teacher.state?.tab || 'gradebook';
    if (['quizzes','performance','exams'].includes(tab)) return 'quizzes';
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

  function classStats(){
    const rows=Array.isArray(Teacher?._classes)?Teacher._classes:[];
    const classes=rows.length;
    const students=rows.reduce((n,x)=>n+Number(x.student_count||0),0);
    const pending=rows.reduce((n,x)=>n+Number(x.pending_count||0),0);
    const selected=Teacher?.getSelectedClass?.()||null;
    return {classes,students,pending,selected};
  }

  function ensureWorkspaceMasthead(section){
    const root=section?.querySelector(':scope > .space-y-6');
    if(!root) return;
    let host=root.querySelector('.fr-workspace-masthead');
    const stats=classStats();
    const user=Store?.user;
    const teacherName=user?.profile
      ? [user.profile.first_name,user.profile.last_name].filter(Boolean).join(' ')
      : (user?.email||'Teacher');

    if(!host){
      host=document.createElement('section');
      host.className='fr-workspace-masthead';
      const mobile=root.querySelector('#'+MOBILE_ID);
      if(mobile) mobile.after(host); else root.prepend(host);
    }

    const selected=stats.selected;
    const classMeta=selected
      ? [selected.year_level,selected.section,selected.room_number?('Room '+selected.room_number):null].filter(Boolean)
      : [];

    host.innerHTML=`
      <div class="relative z-[2] min-w-0">
        <div class="fr-kicker">Teacher Workspace</div>
        <h2 class="fr-workspace-title">Welcome, ${esc(teacherName)}</h2>
        <p class="fr-workspace-subtitle">Manage classes, learners, attendance, assessments and grades from one focused academic workspace.</p>
        <div class="fr-context-line">
          <span class="fr-context-chip"><i class="fa-solid fa-book-open"></i> ${esc(selected?.subject||'No class selected')}</span>
          ${classMeta.map(x=>'<span class="fr-context-chip">'+esc(x)+'</span>').join('')}
        </div>
      </div>
      <div class="fr-masthead-actions">
        <button type="button" class="fr-action-secondary" onclick="Teacher.switchTab('gradebook')"><i class="fa-solid fa-table-list"></i> Gradebook</button>
        <button type="button" class="fr-action-primary" onclick="Teacher.showCreateClass()"><i class="fa-solid fa-plus"></i> New Class</button>
      </div>`;
  }

  function ensureSummary(section){
    const root=section?.querySelector(':scope > .space-y-6');
    if(!root) return;
    let grid=root.querySelector('.fr-summary-grid');
    if(!grid){
      grid=document.createElement('div');
      grid.className='fr-summary-grid';
      const mast=root.querySelector('.fr-workspace-masthead');
      if(mast) mast.after(grid); else root.prepend(grid);
    }
    const s=classStats();
    grid.innerHTML=`
      <div class="fr-summary-card"><div class="fr-stat-icon"><i class="fa-solid fa-layer-group"></i></div><div class="fr-summary-label">Classes</div><div class="fr-summary-value">${s.classes}</div><div class="fr-summary-note">Managed classes</div></div>
      <div class="fr-summary-card"><div class="fr-stat-icon"><i class="fa-solid fa-users"></i></div><div class="fr-summary-label">Students</div><div class="fr-summary-value">${s.students}</div><div class="fr-summary-note">Across active classes</div></div>
      <div class="fr-summary-card fr-summary-gold"><div class="fr-stat-icon"><i class="fa-solid fa-user-clock"></i></div><div class="fr-summary-label">Pending</div><div class="fr-summary-value">${s.pending}</div><div class="fr-summary-note">Enrollment approvals</div></div>
      <div class="fr-summary-card"><div class="fr-stat-icon"><i class="fa-solid fa-book-open-reader"></i></div><div class="fr-summary-label">Current Class</div><div class="fr-summary-value text-[.94rem]">${esc(s.selected?.subject||'—')}</div><div class="fr-summary-note">${esc(s.selected?.section||'Select a class')}</div></div>`;
  }

  function syncRailBadges(){
    const s=classStats();
    const values={classes:s.classes,students:s.students,approvals:s.pending};
    Object.entries(values).forEach(([key,value])=>{
      document.querySelectorAll('[data-fr-badge="'+key+'"]').forEach(el=>{
        const n=Number(value||0);
        el.textContent=n>99?'99+':String(n);
        el.style.display=n>0?'inline-flex':'none';
      });
    });
  }

  function ensureAssessmentSubnav(){
    if(!['quizzes','performance','exams'].includes(Teacher?.state?.tab)) return;
    const box=document.getElementById('teacher-tab-content');
    if(!box || box.querySelector('.fr-assessment-subnav')) return;
    const nav=document.createElement('div');
    nav.className='fr-assessment-subnav';
    const items=[
      ['quizzes','Quizzes','fa-circle-question'],
      ['performance','Performance Tasks','fa-chart-line'],
      ['exams','Exams','fa-file-pen']
    ];
    nav.innerHTML=items.map(([key,label,icon])=>`<button type="button" class="${Teacher.state.tab===key?'active':''}" data-fr-assessment="${key}"><i class="fa-solid ${icon} mr-1"></i>${label}</button>`).join('');
    nav.addEventListener('click',e=>{
      const btn=e.target.closest('[data-fr-assessment]');
      if(btn) Teacher.switchTab(btn.dataset.frAssessment);
    });
    box.prepend(nav);
  }

  function sectionConfig(tab){
    const map={
      students:['Students','Manage the active learner roster for the selected class.','fa-users'],
      attendance:['Attendance','Create, review and manage attendance sessions and learner check-ins.','fa-calendar-check'],
      approvals:['Approvals','Review enrollment requests and admit learners into the selected class.','fa-user-check'],
      quizzes:['Quizzes','Create quizzes, enter scores and manage assessment availability.','fa-circle-question'],
      performance:['Performance Tasks','Record performance-task scores using the class grading structure.','fa-chart-line'],
      exams:['Exams','Manage examination records and learner scores.','fa-file-pen'],
      weights:['Grading Settings','Review class grading weights and component configuration.','fa-sliders']
    };
    return map[tab]||null;
  }

  function ensureSectionBanner(){
    const tab=Teacher?.state?.tab;
    if(tab==='gradebook') return;
    const cfg=sectionConfig(tab);
    const box=document.getElementById('teacher-tab-content');
    if(!box||!cfg||box.querySelector('.fr-section-banner')) return;

    const selected=Teacher?.getSelectedClass?.();
    const banner=document.createElement('div');
    banner.className='fr-section-banner';
    banner.innerHTML=`
      <div class="fr-section-banner-icon"><i class="fa-solid ${cfg[2]}"></i></div>
      <div class="fr-section-banner-copy"><div class="fr-section-banner-title">${cfg[0]}</div><div class="fr-section-banner-text">${cfg[1]}</div></div>
      <span class="fr-section-banner-badge"><i class="fa-solid fa-book-open"></i>${esc(selected?.subject||'Selected class')}</span>`;
    box.prepend(banner);
  }

  function harmonizeStudents(){
    if(Teacher?.state?.tab!=='students') return;
    const box=document.getElementById('teacher-tab-content'); if(!box) return;
    const rows=[...box.querySelectorAll('div.border-b.border-slate-100')];
    rows.forEach(row=>{
      row.dataset.frSurface='student-row';
      const avatar=row.querySelector('span.flex.h-10.w-10');
      if(avatar) avatar.dataset.frSurface='student-avatar';
    });
    const first=box.querySelector('.space-y-4 > .flex');
    if(first) first.dataset.frSurface='toolbar';
  }

  function harmonizeAssessments(){
    if(!['quizzes','performance','exams'].includes(Teacher?.state?.tab)) return;
    document.querySelectorAll('#teacher-tab-content [data-assessment-id]').forEach(card=>card.dataset.frSurface='assessment-card');
    const box=document.getElementById('teacher-tab-content');
    const first=box?.querySelector(':scope > .space-y-4 > .flex, :scope > .space-y-4 > div:first-child');
    if(first && !first.classList.contains('fr-assessment-subnav')) first.dataset.frSurface='toolbar';
  }

  function harmonizeAttendance(){
    if(Teacher?.state?.tab!=='attendance') return;
    const box=document.getElementById('teacher-tab-content'); if(!box) return;
    box.querySelectorAll('.glass-card').forEach(card=>{
      if(card.querySelector('button') || /attendance|session/i.test(card.textContent||'')) card.dataset.frSurface='attendance-card';
    });
    const first=box.querySelector('.space-y-4 > .flex, .space-y-5 > .flex');
    if(first) first.dataset.frSurface='toolbar';
  }

  function harmonizeApprovals(){
    if(Teacher?.state?.tab!=='approvals') return;
    const box=document.getElementById('teacher-tab-content'); if(!box) return;
    box.querySelectorAll('.glass-card, [class*="border-amber"], [class*="bg-amber"]').forEach(card=>{
      const target=card.closest('.glass-card')||card;
      if(target && target!==box) target.dataset.frSurface='approval-card';
    });
  }

  function harmonizeSettings(){
    if(Teacher?.state?.tab!=='weights') return;
    const box=document.getElementById('teacher-tab-content'); if(!box) return;
    box.querySelectorAll('.glass-card, form, [class*="rounded-2xl"]').forEach(panel=>{
      if(panel!==box && !panel.classList.contains('fr-section-banner')) panel.dataset.frSurface='settings-panel';
    });
  }

  function harmonizeEmptyStates(){
    const box=document.getElementById('teacher-tab-content'); if(!box) return;
    box.querySelectorAll('.text-center').forEach(el=>{
      const text=(el.textContent||'').trim();
      if(text && (/no |empty|nothing|not found|loading/i.test(text)) && !el.closest('table')) el.classList.add('fr-empty-quiet');
    });
  }

  function harmonizeTeacherSurfaces(){
    ensureSectionBanner();
    harmonizeStudents();
    harmonizeAssessments();
    harmonizeAttendance();
    harmonizeApprovals();
    harmonizeSettings();
    harmonizeEmptyStates();
  }

  function decorateTeacherModals(){
    if(Store?.user?.role!=='teacher') return;
    const modal=document.getElementById('teacher-class-modal');
    if(modal){
      const card=modal.querySelector(':scope > div.relative');
      card?.setAttribute('data-fr-modal','class');
      const protectedInfo=card?.querySelector('.bg-slate-50.border');
      if(protectedInfo) protectedInfo.dataset.frSurface='settings-panel';
    }
    document.querySelectorAll('[id*="adjust"][id$="-modal"],[id*="unfinalize"][id$="-modal"]').forEach(m=>{
      m.setAttribute('data-fr-modal','teacher');
    });
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
    if(toolbar){
      toolbar.classList.add('fr-grade-toolbar');
      const intro=toolbar.firstElementChild;
      if(intro && !intro.querySelector('.fr-grade-meta')){
        const rows=table.querySelectorAll('tbody tr').length;
        const meta=document.createElement('div');
        meta.className='fr-grade-meta';
        meta.innerHTML='<span class="fr-grade-count"><i class="fa-solid fa-users"></i>'+rows+' learner'+(rows===1?'':'s')+'</span><span><i class="fa-solid fa-shield-halved"></i> Server-calculated grades</span>';
        intro.appendChild(meta);
      }
    }
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
    ensureWorkspaceMasthead(section);
    ensureSummary(section);
    decorateGradebook();
    ensureAssessmentSubnav();
    harmonizeTeacherSurfaces();
    decorateTeacherModals();
    syncRailBadges();
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
    if(e.target.closest('[onclick*="showCreateClass"],[onclick*="editClass"],[onclick*="openAdjustmentModal"],[onclick*="requestUnfinalize"]')){
      setTimeout(decorateTeacherModals,0);
    }
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