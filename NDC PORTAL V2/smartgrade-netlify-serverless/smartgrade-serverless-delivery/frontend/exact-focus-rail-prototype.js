// Exact Focus Rail port — based on the uploaded NGC Focus Rail prototype.
// Presentation/UX only. Existing auth, API, grading, attendance, approval,
// assessment, account-integrity and database logic remain authoritative.
(() => {
  const param = new URLSearchParams(window.location.search).get('exactFocusRail');
  if (String(param || '').toLowerCase() === 'off') return;

  const STYLE_ID='sg-exact-focus-rail-style';
  const RAIL_ID='sg-focus-rail';
  const ROOT_CLASS='sg-exact-focus-prototype';

  const css=`
    :root{
      --efr-navy:#173f6b;
      --efr-navy-deep:#123761;
      --efr-blue:#2f67e8;
      --efr-gold:#f3c52f;
      --efr-canvas:#f7f9fc;
      --efr-line:#d8e1eb;
      --efr-ink:#17324f;
      --efr-muted:#6d8096;
      --efr-soft:#eef3f8;
      --efr-success:#16945f;
      --efr-warning:#b9790d;
    }

    body:has(#teacher-section:not(.hidden)){background:var(--efr-canvas)!important}
    body:has(#teacher-section:not(.hidden)) main{
      max-width:none!important;padding-left:0!important;padding-right:0!important;padding-top:0!important
    }
    body:has(#teacher-section:not(.hidden)) .portal-header{
      background:#fff!important;color:var(--efr-ink)!important;border-bottom:1px solid var(--efr-line)!important;box-shadow:none!important
    }
    body:has(#teacher-section:not(.hidden)) .portal-header .header-glow{display:none!important}
    body:has(#teacher-section:not(.hidden)) .portal-header .max-w-7xl{
      max-width:none!important;padding-left:292px!important;padding-right:24px!important
    }
    body:has(#teacher-section:not(.hidden)) .portal-header #institution-name-header{
      line-height:1.02!important;
      margin:0!important;
    }
    body:has(#teacher-section:not(.hidden)) .portal-header h1{
      line-height:1.06!important;
      margin-top:2px!important;
      margin-bottom:0!important;
    }
    body:has(#teacher-section:not(.hidden)) .portal-header #institution-name-header + h1 + p{
      line-height:1.08!important;
      margin-top:2px!important;
      margin-bottom:0!important;
    }
    .exact-teacher-heading h1{margin:0;color:var(--efr-ink)!important;font-size:1.2rem;line-height:1.15;font-weight:900;letter-spacing:-.02em}
    .exact-teacher-heading p{margin:4px 0 0!important;color:#7a899a!important;font-size:.70rem!important;font-weight:600}

    #teacher-section.sg-focus-rail-active.sg-exact-focus-prototype:not(.hidden){
      display:block!important;
      grid-template-columns:none!important;
      gap:0!important;
      max-width:none!important;
      width:100%!important;
      padding:0!important;
      margin:0!important;
      color:var(--efr-ink)!important
    }
    #teacher-section.sg-focus-rail-active.sg-exact-focus-prototype:not(.hidden) > .space-y-6{
      display:block!important;
      grid-column:auto!important;
      width:auto!important;
      min-width:0!important;
      margin:0 0 0 264px!important;
      padding:18px 30px 34px!important;
      max-width:none!important
    }
    #teacher-section.sg-exact-focus-prototype .fr-workspace-masthead,
    #teacher-section.sg-exact-focus-prototype .fr-summary-grid,
    #teacher-section.sg-exact-focus-prototype [data-exact-hide="true"]{display:none!important}

    #sg-focus-rail.exact-focus-rail{
      position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:264px!important;min-height:100vh!important;
      border:0!important;border-radius:0!important;background:linear-gradient(180deg,var(--efr-navy) 0%,var(--efr-navy-deep) 100%)!important;
      box-shadow:none!important;z-index:48!important;overflow-y:auto!important;color:#fff!important
    }
    .exact-brand{display:block;min-height:112px;padding:26px 22px 20px;border-bottom:1px solid rgba(255,255,255,.08)}
    .exact-brand strong{display:block;font-size:1.02rem;line-height:1.2;color:#fff;letter-spacing:-.01em;font-weight:900}
    .exact-brand span{display:block;margin-top:7px;font-size:.66rem;line-height:1.35;color:#b7c7da;font-weight:700}
    .exact-primary-nav{padding:8px 0 10px}
    .exact-primary-nav button{
      width:100%;min-height:52px;display:flex;align-items:center;gap:14px;padding:0 22px;border:0;border-left:5px solid transparent;
      background:transparent;color:#eef4fb;font-size:.82rem;font-weight:800;text-align:left;border-radius:0!important
    }
    .exact-primary-nav button i{width:18px;text-align:center;font-size:.92rem}
    .exact-primary-nav button:hover{background:rgba(255,255,255,.06)!important}
    .exact-primary-nav button.active{background:rgba(255,255,255,.10)!important;border-left-color:var(--efr-gold)!important;color:#fff!important}
    .exact-primary-nav .badge{
      margin-left:auto;display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:99px;background:#ef4444;color:#fff;font-size:.56rem;font-weight:900
    }
    .exact-rail-divider{height:1px;margin:6px 20px 0;background:rgba(255,255,255,.12)}
    .exact-rail-label{margin:16px 22px 9px!important;color:#9eb0c6!important;font-size:.62rem!important;font-weight:900!important;letter-spacing:.12em!important;text-transform:uppercase}
    .exact-class-list{display:flex;flex-direction:column}
    .exact-class-item{
      position:relative;width:100%;min-height:78px;padding:12px 18px 12px 24px;border:0;border-left:5px solid transparent;
      background:transparent;color:#fff;text-align:left;border-radius:0!important
    }
    .exact-class-item:hover{background:rgba(255,255,255,.055)!important}
    .exact-class-item.selected{background:rgba(255,255,255,.10)!important;border-left-color:var(--efr-gold)!important}
    .exact-class-item strong{display:block;max-width:168px;color:#fff;font-size:.73rem;line-height:1.35;font-weight:900}
    .exact-class-item small{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:5px;color:#b8c7d8;font-size:.61rem;font-weight:650}
    .exact-selected-copy{
      display:inline-flex!important;align-items:center!important;justify-content:center!important;
      width:24px!important;height:24px!important;padding:0!important;margin-left:4px!important;
      border:1px solid #cbd5e1!important;border-radius:7px!important;background:#fff!important;
      color:var(--efr-blue)!important;font-size:.62rem!important;vertical-align:middle!important
    }
    .exact-selected-copy:hover{background:#eef4ff!important}
    .exact-selected-edit{
      display:inline-flex!important;align-items:center!important;justify-content:center!important;
      min-width:28px!important;height:24px!important;padding:0 7px!important;margin-left:4px!important;
      border:1px solid #cbd5e1!important;border-radius:7px!important;background:#fff!important;
      color:var(--efr-blue)!important;font-size:.62rem!important;vertical-align:middle!important
    }
    .exact-selected-edit:hover{background:#eef4ff!important}
    .exact-create-class{
      width:calc(100% - 36px)!important;min-height:44px;margin:18px!important;border:1px solid #5d8bf0!important;border-radius:9px!important;
      background:var(--efr-blue)!important;color:#fff!important;font-size:.78rem!important;font-weight:900!important
    }

    .exact-class-strip{
      margin:0 0 16px;padding:14px 16px 16px;border:1px solid var(--efr-line);border-radius:14px;background:#fff;
      box-shadow:0 8px 24px rgba(23,59,103,.045)
    }
    #teacher-section.sg-exact-focus-prototype[data-exact-view="classes"] .exact-class-strip{
      display:block!important
    }
    .exact-class-strip-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}
    .exact-class-strip-head>div{display:flex;align-items:center;gap:10px}
    .exact-class-strip-head strong{color:var(--efr-ink);font-size:.74rem}
    .exact-strip-create{
      min-height:40px;padding:0 15px;border:1px solid rgba(255,255,255,.30);border-radius:10px;
      background:linear-gradient(135deg,#2563eb,#1d4ed8)!important;color:#fff!important;
      font-size:.69rem;font-weight:900;box-shadow:0 9px 18px rgba(37,99,235,.20);
      transition:transform .16s ease,box-shadow .16s ease,filter .16s ease
    }
    .exact-strip-create:hover{transform:translateY(-2px);box-shadow:0 13px 24px rgba(37,99,235,.26);filter:brightness(1.04)}
    .exact-strip-create:active{transform:translateY(0) scale(.98)}
    .exact-strip-create i{margin-right:6px}
    .exact-class-strip-track{
      display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px
    }
    .exact-strip-card{
      --card-accent:#2563eb;
      --card-accent-2:#60a5fa;
      --card-tint:rgba(37,99,235,.10);
      position:relative;min-width:0;border:1px solid rgba(255,255,255,.72);border-radius:16px;
      background:
        linear-gradient(145deg,rgba(255,255,255,.88),rgba(255,255,255,.58)),
        linear-gradient(135deg,var(--card-tint),rgba(255,255,255,.10));
      overflow:hidden;
      box-shadow:0 10px 26px rgba(15,23,42,.09),inset 0 1px 0 rgba(255,255,255,.85);
      backdrop-filter:blur(14px) saturate(135%);
      -webkit-backdrop-filter:blur(14px) saturate(135%);
      transition:transform .20s ease,box-shadow .20s ease,border-color .20s ease,filter .20s ease;
      isolation:isolate
    }
    .exact-strip-card::before{
      content:"";position:absolute;inset:0 0 auto 0;height:5px;
      background:linear-gradient(90deg,var(--card-accent),var(--card-accent-2));
      z-index:2
    }
    .exact-strip-card::after{
      content:"";position:absolute;width:110px;height:110px;border-radius:999px;right:-34px;top:-40px;
      background:radial-gradient(circle,var(--card-tint) 0%,rgba(255,255,255,0) 70%);
      pointer-events:none;z-index:0
    }
    .exact-strip-card:nth-child(4n+1){--card-accent:#2563eb;--card-accent-2:#38bdf8;--card-tint:rgba(37,99,235,.15)}
    .exact-strip-card:nth-child(4n+2){--card-accent:#7c3aed;--card-accent-2:#a78bfa;--card-tint:rgba(124,58,237,.14)}
    .exact-strip-card:nth-child(4n+3){--card-accent:#0f9f8f;--card-accent-2:#34d399;--card-tint:rgba(15,159,143,.14)}
    .exact-strip-card:nth-child(4n+4){--card-accent:#d97706;--card-accent-2:#fbbf24;--card-tint:rgba(217,119,6,.15)}
    .exact-strip-card:hover{
      transform:translateY(-5px) scale(1.015);
      box-shadow:0 18px 34px rgba(15,23,42,.14),0 0 0 1px color-mix(in srgb,var(--card-accent) 28%,transparent);
      filter:saturate(1.05)
    }
    .exact-strip-card.selected{
      border-color:color-mix(in srgb,var(--card-accent) 82%,white);
      box-shadow:0 20px 40px rgba(15,23,42,.16),0 0 0 4px color-mix(in srgb,var(--card-accent) 28%,transparent);
      transform:translateY(-3px) scale(1.01)
    }
    .exact-strip-card.selected::before{height:6px}
    .exact-selected-ribbon{
      display:flex!important;align-items:center!important;gap:6px!important;
      width:max-content!important;max-width:100%!important;
      margin:0 0 10px!important;padding:6px 10px!important;border-radius:8px!important;
      background:var(--card-accent)!important;color:#fff!important;
      box-shadow:0 6px 14px rgba(15,23,42,.13)!important;
      font-family:inherit!important;font-size:10px!important;font-weight:900!important;
      line-height:1.15!important;letter-spacing:.02em!important;white-space:nowrap!important;
      opacity:1!important;visibility:visible!important
    }
    .exact-selected-ribbon i,.exact-selected-ribbon span{
      display:inline-block!important;color:#fff!important;
      font-size:10px!important;font-weight:900!important;line-height:1.15!important;
      opacity:1!important;visibility:visible!important
    }
    .exact-strip-card.selected .exact-strip-open{padding-top:17px}
    .exact-strip-open{
      position:relative;z-index:1;display:block;width:100%;padding:17px 14px 42px;border:0;background:transparent!important;text-align:left;color:var(--efr-ink)!important
    }
    .exact-strip-open strong{
      display:block;padding-right:22px;color:#0f2742;font-size:.78rem;line-height:1.32;font-weight:950;letter-spacing:-.01em
    }
    .exact-strip-open span,.exact-strip-open small{display:block;margin-top:5px;color:#66778c;font-size:.63rem;line-height:1.35;font-weight:650}
    .exact-strip-open small{color:color-mix(in srgb,var(--card-accent) 78%,#334155);font-weight:800}
    .exact-strip-edit{
      position:absolute;left:11px;bottom:9px;z-index:3;min-height:27px;padding:0 9px;border:1px solid color-mix(in srgb,var(--card-accent) 26%,#d6dee8);border-radius:8px;
      background:rgba(255,255,255,.82)!important;color:var(--card-accent)!important;font-size:.60rem;font-weight:900;
      box-shadow:0 4px 10px rgba(15,23,42,.06);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
      transition:transform .16s ease,background .16s ease,box-shadow .16s ease
    }
    .exact-strip-edit:hover{transform:translateY(-1px);background:#fff!important;box-shadow:0 7px 14px rgba(15,23,42,.10)}
    .exact-strip-edit i{margin-right:4px}
    .exact-strip-empty{padding:16px;border:1px dashed #cbd5e1;border-radius:10px;color:#718298;font-size:.68rem}
    .exact-rail-footer{margin-top:38px;padding:22px;border-top:1px solid rgba(255,255,255,.08);color:#9eb0c6;font-size:.60rem;line-height:1.45}
    .exact-rail-footer strong{display:block;color:#c8d5e4;font-size:.64rem;margin-bottom:2px}

    .exact-view-panel{
      display:none;
      margin:4px 0 22px;
    }
    #teacher-section.sg-exact-focus-prototype[data-exact-view="dashboard"] .exact-view-panel,
    #teacher-section.sg-exact-focus-prototype[data-exact-view="notifications"] .exact-view-panel,
    #teacher-section.sg-exact-focus-prototype[data-exact-view="profile"] .exact-view-panel{display:block}
    #teacher-section.sg-exact-focus-prototype[data-exact-view="dashboard"] .exact-class-workspace,
    #teacher-section.sg-exact-focus-prototype[data-exact-view="notifications"] .exact-class-workspace,
    #teacher-section.sg-exact-focus-prototype[data-exact-view="profile"] .exact-class-workspace{display:none!important}

    .exact-page-head{margin:6px 0 22px}
    .exact-page-kicker{font-size:.64rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#8a9aab}
    .exact-page-head h2{margin:5px 0 0;color:var(--efr-ink);font-size:1.8rem;line-height:1.14;font-weight:900;letter-spacing:-.035em}
    .exact-page-head p{margin:7px 0 0;color:var(--efr-muted);font-size:.76rem;line-height:1.55}

    .exact-big-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
    .exact-big-card{
      min-height:174px;padding:24px;border:1px solid var(--efr-line);border-radius:16px;background:#fff;
      box-shadow:0 12px 28px rgba(23,59,103,.055)
    }
    .exact-big-card .icon{
      width:48px;height:48px;display:grid;place-items:center;border-radius:13px;background:#edf4ff;color:var(--efr-blue);font-size:1.12rem
    }
    .exact-big-card.gold .icon{background:#fff5cf;color:#9a6b08}
    .exact-big-card.green .icon{background:#e9f7f0;color:#168457}
    .exact-big-card .label{margin-top:19px;color:#718298;font-size:.66rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}
    .exact-big-card .value{margin-top:5px;color:var(--efr-ink);font-size:2.1rem;font-weight:900;letter-spacing:-.04em}
    .exact-big-card .note{margin-top:4px;color:#8a99aa;font-size:.64rem}

    .exact-mini-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}
    .exact-mini-card{padding:16px 18px;border:1px solid var(--efr-line);border-radius:13px;background:#fff}
    .exact-mini-card strong{display:block;color:var(--efr-ink);font-size:1.25rem;font-weight:900}
    .exact-mini-card span{display:block;margin-top:3px;color:var(--efr-muted);font-size:.62rem}

    .exact-notification-list{display:grid;gap:12px}
    .exact-notification-card{
      display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;padding:17px 18px;
      border:1px solid var(--efr-line);border-radius:14px;background:#fff
    }
    .exact-notification-card h4{margin:0;color:var(--efr-ink);font-size:.78rem;font-weight:900}
    .exact-notification-card p{margin:5px 0 0;color:var(--efr-muted);font-size:.65rem}
    .exact-notification-actions{display:flex;gap:8px;flex-wrap:wrap}
    .exact-notification-actions button{min-height:36px;padding:0 12px;border-radius:9px;font-size:.64rem;font-weight:900}
    .exact-approve{background:#168457!important;color:#fff!important}
    .exact-reject{background:#fff!important;color:#c43d45!important;border:1px solid #efc9cc!important}

    @media(max-width:820px){
      .exact-big-stats,.exact-mini-stats{grid-template-columns:1fr}
      .exact-notification-card{grid-template-columns:1fr}
      .exact-class-strip-track{display:flex;overflow-x:auto;scroll-snap-type:x proximity;padding-bottom:4px}
      .exact-strip-card{flex:0 0 220px;scroll-snap-align:start}
    }

    .exact-breadcrumbs{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 14px;color:#8795a6;font-size:.66rem;font-weight:600}
    .exact-breadcrumbs i{font-size:.52rem;color:#a5b1bd}

    #teacher-section.sg-exact-focus-prototype .sg-ref-selected{
      margin:0!important;padding:0 0 14px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important
    }
    #teacher-section.sg-exact-focus-prototype .sg-ref-selected > div{
      display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:24px!important;align-items:center!important
    }
    #teacher-section.sg-exact-focus-prototype .sg-ref-selected > div > div:first-child{position:relative;padding-left:18px}
    #teacher-section.sg-exact-focus-prototype .sg-ref-selected > div > div:first-child::before{
      content:"";position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:4px;background:var(--efr-blue)
    }
    #teacher-section.sg-exact-focus-prototype #teacher-selected-class-name{
      color:var(--efr-ink)!important;font-size:1.55rem!important;line-height:1.18!important;font-weight:900!important;letter-spacing:-.03em!important
    }
    #teacher-section.sg-exact-focus-prototype #teacher-selected-class-meta{
      color:var(--efr-muted)!important;font-size:.72rem!important;font-weight:700!important;margin-top:6px!important
    }
    #teacher-section.sg-exact-focus-prototype .sg-ref-selected label{color:#334155!important;font-size:.70rem!important;font-weight:800!important}
    #teacher-section.sg-exact-focus-prototype .sg-ref-selected select{
      min-width:360px!important;height:44px!important;border:1px solid #cbd5e1!important;border-radius:9px!important;background:#fff!important;
      color:var(--efr-ink)!important;font-size:.70rem!important;font-weight:800!important
    }

    #teacher-section.sg-exact-focus-prototype .sg-ref-tabs{
      display:flex!important;gap:0!important;overflow-x:auto!important;padding:0!important;margin:0!important;background:transparent!important;
      border:0!important;border-bottom:1px solid var(--efr-line)!important;border-radius:0!important
    }
    #teacher-section.sg-exact-focus-prototype .sg-ref-tabs .tab-btn{
      position:relative!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;
      min-height:52px!important;padding:0 18px!important;border:0!important;border-radius:0!important;color:#50647b!important;
      background:transparent!important;font-size:.70rem!important;font-weight:850!important;white-space:nowrap!important
    }
    #teacher-section.sg-exact-focus-prototype .sg-ref-tabs .tab-btn.active{color:var(--efr-blue)!important;background:transparent!important}
    #teacher-section.sg-exact-focus-prototype .sg-ref-tabs .tab-btn.active::after{
      content:"";position:absolute;left:16%;right:16%;bottom:-1px;height:3px;border-radius:3px;background:var(--efr-blue)!important
    }

    .exact-summary-strip{
      display:grid;grid-template-columns:.9fr .9fr 1.25fr .9fr;margin:18px 0;border:1px solid var(--efr-line);border-radius:12px;
      background:#fff;overflow:hidden;box-shadow:0 8px 22px rgba(23,59,103,.045)
    }
    .exact-summary-strip>div{display:flex;align-items:center;gap:12px;min-height:72px;padding:12px 18px;border-right:1px solid var(--efr-line)}
    .exact-summary-strip>div:last-child{border-right:0}
    .exact-summary-strip>div>i{width:30px;color:var(--efr-blue);font-size:21px;text-align:center}
    .exact-summary-strip>div:nth-child(2)>i{color:var(--efr-warning)}
    .exact-summary-strip .save-dot{width:10px;height:10px;border-radius:50%;background:#17a673}
    .exact-summary-strip span{display:grid;gap:3px}
    .exact-summary-strip strong{font-size:.82rem;color:var(--efr-ink)}
    .exact-summary-strip small{font-size:.59rem;color:var(--efr-muted)}

    #teacher-tab-content{
      padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important
    }
    #teacher-tab-content .space-y-4{gap:0!important}
    #teacher-tab-content .space-y-4 > div:first-child{
      display:grid!important;grid-template-columns:minmax(250px,1fr) 230px auto!important;gap:12px!important;align-items:end!important;margin:0 0 18px!important
    }
    #teacher-tab-content .space-y-4 > div:first-child > div:first-child{display:none!important}
    #teacher-grade-filter{
      grid-column:1!important;width:100%!important;height:46px!important;border:1px solid #cbd5e1!important;border-radius:10px!important;
      padding:0 14px!important;background:#fff!important;color:var(--efr-ink)!important;font-size:.70rem!important
    }
    .exact-filter-wrap{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:9px;color:#334155;font-size:.66rem;font-weight:800}
    .exact-filter-wrap select{
      height:46px;padding:0 34px 0 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:var(--efr-ink);font-size:.68rem;font-weight:800
    }
    .exact-export-btn{
      min-height:46px;padding:0 16px;border:1px solid var(--efr-blue);border-radius:9px;background:#fff;color:var(--efr-blue);font-size:.68rem;font-weight:900
    }

    #teacher-grade-table{
      min-width:1040px!important;border-collapse:separate!important;border-spacing:0!important;background:#fff!important
    }
    #teacher-grade-table thead th{
      position:sticky!important;top:0!important;z-index:3!important;height:54px!important;padding:8px 11px!important;background:#e9eff6!important;
      color:var(--efr-ink)!important;font-size:.58rem!important;font-weight:900!important;letter-spacing:.01em!important;text-align:center!important;
      text-transform:uppercase!important;border-right:1px solid var(--efr-line)!important;border-bottom:1px solid var(--efr-line)!important
    }
    #teacher-grade-table thead th:first-child{left:0!important;text-align:left!important;z-index:5!important}
    #teacher-grade-table tbody td{
      height:57px!important;padding:8px 11px!important;background:#fff!important;color:#334155!important;font-size:.64rem!important;text-align:center!important;
      border-right:1px solid var(--efr-line)!important;border-bottom:1px solid var(--efr-line)!important
    }
    #teacher-grade-table tbody tr:hover td{background:#f8fbff!important}
    #teacher-grade-table tbody td:first-child{
      position:sticky!important;left:0!important;z-index:2!important;min-width:190px!important;background:#fff!important;text-align:left!important;
      color:var(--efr-ink)!important;font-size:.66rem!important;font-weight:900!important
    }
    #teacher-grade-table tbody tr:hover td:first-child{background:#f8fbff!important}
    #teacher-grade-table td button{font-weight:850!important}
    #teacher-grade-table span.text-amber-600{
      display:inline-block!important;padding:6px 9px!important;border-radius:999px!important;background:#fff3dc!important;color:var(--efr-warning)!important
    }
    #teacher-grade-table span.text-emerald-600{
      display:inline-block!important;padding:6px 9px!important;border-radius:999px!important;background:#e5f6ef!important;color:var(--efr-success)!important
    }
    .exact-grade-panel{
      border:1px solid var(--efr-line)!important;border-radius:12px!important;background:#fff!important;overflow:auto!important;
      box-shadow:0 12px 30px rgba(23,59,103,.055)!important
    }
    .exact-grade-title{display:flex;align-items:flex-end;justify-content:space-between;padding:15px 18px;border-bottom:1px solid var(--efr-line);background:#fff}
    .exact-grade-title h3{margin:0;color:var(--efr-ink);font-size:1rem;font-weight:900}
    .exact-grade-title p,.exact-grade-title span{margin:4px 0 0;color:var(--efr-muted);font-size:.58rem}

    @media(max-width:1000px){
      body:has(#teacher-section:not(.hidden)) .portal-header .max-w-7xl{padding-left:18px!important}
      #sg-focus-rail.exact-focus-rail{left:-264px!important;transition:left .2s ease}
      #sg-focus-rail.exact-focus-rail.mobile-open{left:0!important}
      #teacher-section.sg-focus-rail-active.sg-exact-focus-prototype:not(.hidden) > .space-y-6{margin-left:0!important;padding:16px!important}
      #teacher-section.sg-exact-focus-prototype .sg-ref-selected > div{grid-template-columns:1fr!important}
      #teacher-section.sg-exact-focus-prototype .sg-ref-selected select{min-width:0!important;width:100%!important}
      .exact-summary-strip{grid-template-columns:1fr 1fr}
      .exact-summary-strip>div:nth-child(2){border-right:0}
      .exact-summary-strip>div:nth-child(-n+2){border-bottom:1px solid var(--efr-line)}
    }
    @media(max-width:680px){
      .exact-summary-strip{grid-template-columns:1fr}
      .exact-summary-strip>div{border-right:0;border-bottom:1px solid var(--efr-line)}
      .exact-summary-strip>div:last-child{border-bottom:0}
      #teacher-tab-content .space-y-4 > div:first-child{grid-template-columns:1fr!important}
      #teacher-grade-filter{grid-column:auto!important}
    }
  `;

  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=css;
    document.head.appendChild(style);
  }

  function teacherVisible(){
    const s=document.getElementById('teacher-section');
    return s && !s.classList.contains('hidden');
  }
  function selectedClass(){try{return Teacher?.getSelectedClass?.()||null}catch{return null}}
  function classRows(){try{return Array.isArray(Teacher?._classes)?Teacher._classes:[]}catch{return []}}
  function logoSrc(){return document.querySelector('.portal-header img')?.getAttribute('src') || './assets/logo.png'}

  function decorateHeader(){
    // Keep the portal's original NDC institutional branding in the global header.
    restoreHeader();
  }

  function restoreHeader(){
    const header=document.querySelector('.portal-header');
    const brand=header?.querySelector('.max-w-7xl > div > div:first-child');
    if(!brand || !brand.dataset.exactOriginalHtml || brand.dataset.exactTeacherHeader!=='1') return;
    brand.innerHTML=brand.dataset.exactOriginalHtml;
    brand.setAttribute('onclick','Views.home()');
    delete brand.dataset.exactTeacherHeader;
  }

  let exactView='profile';

  function totals(){
    const rows=classRows();
    return {
      classes:rows.length,
      students:rows.reduce((n,c)=>n+Number(c.student_count||0),0),
      pending:rows.reduce((n,c)=>n+Number(c.pending_count||0),0)
    };
  }

  function teacherDisplayName(){
    const text=document.getElementById('user-name-display')?.textContent?.trim();
    if(text) return text.toUpperCase();
    const p=Store?.user?.profile;
    const fallback=p?[p.first_name,p.last_name].filter(Boolean).join(' '):(Store?.user?.email||'TEACHER');
    return String(fallback||'TEACHER').toUpperCase();
  }

  function setExactView(view){
    exactView=view;
    const section=document.getElementById('teacher-section');
    if(section) section.dataset.exactView=view;
    if(view==='notifications'){
      const panel=section?.querySelector('.exact-view-panel');
      if(panel) delete panel.dataset.notificationsState;
    }
    syncExactNav();
    renderExactView();
  }

  function syncExactNav(){
    document.querySelectorAll('#sg-focus-rail [data-exact-nav]').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.exactNav===exactView);
    });
  }

  function workspaceNodes(){
    const section=document.getElementById('teacher-section');
    if(!section) return [];
    return [
      section.querySelector('.exact-breadcrumbs'),
      document.getElementById('teacher-selected-class-name')?.closest('.glass-card'),
      section.querySelector('.exact-class-strip'),
      section.querySelector('.sg-ref-tabs')?.parentElement || section.querySelector('.sg-ref-tabs'),
      section.querySelector('.exact-summary-strip'),
      document.getElementById('teacher-tab-content')
    ].filter(Boolean);
  }

  function markWorkspace(){
    workspaceNodes().forEach(n=>n.classList.add('exact-class-workspace'));
  }

  function ensureViewPanel(){
    const section=document.getElementById('teacher-section');
    const root=section?.querySelector(':scope > .space-y-6');
    if(!root) return null;
    let panel=root.querySelector('.exact-view-panel');
    if(!panel){
      panel=document.createElement('section');
      panel.className='exact-view-panel';
      const firstVisible=[...root.children].find(x=>!x.matches('#sg-focus-mobile-nav,#sg-focus-rail,.fr-workspace-masthead,.fr-summary-grid,[data-exact-hide="true"]'));
      if(firstVisible) firstVisible.before(panel); else root.prepend(panel);
    }
    return panel;
  }

  async function renderNotificationsPanel(panel, force=false){
    const classes=classRows();
    const notificationKey=JSON.stringify(classes.map(c=>[c.id,c.pending_count||0]));
    const loadingState='loading:'+notificationKey;
    const readyState='ready:'+notificationKey;

    if(!force && (panel.dataset.notificationsState===loadingState || panel.dataset.notificationsState===readyState)){
      return;
    }

    panel.dataset.notificationsState=loadingState;

    if(classes.length===0){
      panel.innerHTML=`
        <div class="exact-page-head">
          <div class="exact-page-kicker">Notifications</div>
          <h2>Pending Enrollment Requests</h2>
          <p>0 pending requests across all subjects you created.</p>
        </div>
        <div class="exact-notification-list">
          <div class="exact-big-card green">
            <div class="icon"><i class="fa-solid fa-circle-check"></i></div>
            <div class="label">All Clear</div>
            <div class="value">0</div>
            <div class="note">No pending enrollment requests across your classes.</div>
          </div>
        </div>`;
      panel.dataset.notificationsState=readyState;
      return;
    }

    panel.innerHTML='<div class="exact-page-head"><div class="exact-page-kicker">Notifications</div><h2>Pending Enrollment Requests</h2><p>Loading pending requests from all classes...</p></div>';

    const silentGet=async path=>{
      try{
        const headers={'Content-Type':'application/json'};
        if(Store?.token) headers.Authorization='Bearer '+Store.token;
        const res=await fetch(API_BASE+path,{method:'GET',headers});
        if(!res.ok) return {ok:false,rows:[]};
        const data=await res.json().catch(()=>[]);
        return {ok:true,rows:Array.isArray(data)?data:[]};
      }catch{
        return {ok:false,rows:[]};
      }
    };

    const groups=[];
    let failed=0;

    // Load sequentially to avoid a burst of simultaneous requests/toasts.
    for(const cls of classes){
      const result=await silentGet('/classes/'+cls.id+'/pending-enrollments');
      if(!result.ok) failed++;
      groups.push({cls,rows:result.rows});
    }

    const all=groups.flatMap(g=>g.rows.map(r=>({cls:g.cls,row:r})));
    const unavailable=failed>0
      ? '<div class="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800"><i class="fa-solid fa-triangle-exclamation mr-2"></i>'+failed+' class'+(failed===1?'':'es')+' could not be checked right now. No repeated error notifications will be shown; refresh this page to try again.</div>'
      : '';

    panel.innerHTML=`
      <div class="exact-page-head">
        <div class="exact-page-kicker">Notifications</div>
        <h2>Pending Enrollment Requests</h2>
        <p>${all.length} pending request${all.length===1?'':'s'} across all subjects you created.</p>
      </div>
      ${unavailable}
      <div class="exact-notification-list">
        ${all.length?all.map(item=>`
          <article class="exact-notification-card">
            <div>
              <h4>${esc((item.row.first_name||'')+' '+(item.row.last_name||''))}</h4>
              <p>${esc(item.row.email||'')} &nbsp;•&nbsp; ${esc(item.cls.subject||'Class')} ${item.cls.section?'— '+esc(item.cls.section):''}</p>
            </div>
            <div class="exact-notification-actions">
              <button type="button" class="exact-approve" data-exact-approve="${esc(item.row.id)}" data-exact-class-id="${esc(item.cls.id)}">Approve</button>
              <button type="button" class="exact-reject" data-exact-reject="${esc(item.row.id)}" data-exact-class-id="${esc(item.cls.id)}">Reject</button>
            </div>
          </article>
        `).join(''):(failed===classes.length && classes.length
          ? '<div class="exact-big-card gold"><div class="icon"><i class="fa-solid fa-wifi"></i></div><div class="label">Temporarily Unavailable</div><div class="value">—</div><div class="note">Pending requests could not be loaded. Please try again shortly.</div></div>'
          : '<div class="exact-big-card green"><div class="icon"><i class="fa-solid fa-circle-check"></i></div><div class="label">All Clear</div><div class="value">0</div><div class="note">No pending enrollment requests across your classes.</div></div>')}
      </div>`;

    panel.dataset.notificationsState=readyState;

    panel.querySelectorAll('[data-exact-approve]').forEach(btn=>btn.addEventListener('click',async()=>{
      Teacher.state.classId=btn.dataset.exactClassId;
      await Teacher.approveStudent(btn.dataset.exactApprove);
      exactView='notifications';
      delete panel.dataset.notificationsState;
      renderNotificationsPanel(panel,true);
    }));
    panel.querySelectorAll('[data-exact-reject]').forEach(btn=>btn.addEventListener('click',async()=>{
      Teacher.state.classId=btn.dataset.exactClassId;
      await Teacher.rejectStudent(btn.dataset.exactReject);
      exactView='notifications';
      delete panel.dataset.notificationsState;
      renderNotificationsPanel(panel,true);
    }));
  }

  function openTeacherProfileEditor(){
    const p=Store?.user?.profile||{};
    const host=document.createElement('div');
    host.id='teacher-edit-profile-modal';
    host.className='fixed inset-0 z-[170] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4';
    host.innerHTML=`
      <div class="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 class="text-lg font-black text-slate-800"><i class="fa-solid fa-user-pen mr-2 text-blue-600"></i>Edit Teacher Profile</h3>
            <p class="mt-1 text-xs text-slate-500">Update your basic information and the active email used for password recovery.</p>
          </div>
          <button type="button" data-close-teacher-profile class="h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-100"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="teacher-profile-form" class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <label class="text-xs font-bold text-slate-600">First Name<input id="teacher-profile-first" required value="${esc(p.first_name||'')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"></label>
          <label class="text-xs font-bold text-slate-600">Last Name<input id="teacher-profile-last" required value="${esc(p.last_name||'')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"></label>
          <label class="text-xs font-bold text-slate-600 sm:col-span-2">Department<input id="teacher-profile-department" value="${esc(p.department||'')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"></label>
          <label class="text-xs font-bold text-slate-600 sm:col-span-2">Email Address<input id="teacher-profile-email" type="email" required value="${esc(Store?.user?.email||'')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><span class="mt-1 block text-[10px] font-medium text-slate-400">Use an active email. Forgot Password reset links will be sent here.</span></label>
          <div class="flex justify-end gap-2 pt-2 sm:col-span-2">
            <button type="button" data-close-teacher-profile class="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">Cancel</button>
            <button type="submit" class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"><i class="fa-solid fa-floppy-disk mr-1"></i>Save Changes</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(host);
    host.querySelectorAll('[data-close-teacher-profile]').forEach(btn=>btn.addEventListener('click',()=>host.remove()));
    host.querySelector('#teacher-profile-form')?.addEventListener('submit',async e=>{
      e.preventDefault();
      try{
        const data=await api('PUT','/auth/profile/teacher',{
          firstName:document.getElementById('teacher-profile-first')?.value||'',
          lastName:document.getElementById('teacher-profile-last')?.value||'',
          department:document.getElementById('teacher-profile-department')?.value||'',
          email:document.getElementById('teacher-profile-email')?.value||''
        });
        const current=Store.user||{};
        Store.user={...current,email:data.email||current.email,profile:data.profile||current.profile};
        host.remove();
        Toast.show('Profile Updated',data.message||'Teacher profile updated successfully.','success');
        exactView='profile';
        renderExactView();
        const name=document.getElementById('user-name-display');
        if(name) name.textContent=data.profile?[data.profile.first_name,data.profile.last_name].filter(Boolean).join(' '):(data.email||current.email||'');
      }catch{}
    });
  }

  function renderExactView(){
    const panel=ensureViewPanel();
    const section=document.getElementById('teacher-section');
    if(!panel||!section) return;
    section.dataset.exactView=exactView;
    markWorkspace();
    const s=totals();

    if(exactView==='dashboard'){
      panel.innerHTML=`
        <div class="exact-page-head">
          <div class="exact-page-kicker">Teacher Dashboard</div>
          <h2>Overall Teaching Overview</h2>
          <p>A consolidated view of your active classes, enrolled learners, and pending enrollment requests.</p>
        </div>
        <div class="exact-big-stats">
          <div class="exact-big-card"><div class="icon"><i class="fa-solid fa-book-open"></i></div><div class="label">Number of Classes</div><div class="value">${s.classes}</div><div class="note">Classes created under your account</div></div>
          <div class="exact-big-card green"><div class="icon"><i class="fa-solid fa-users"></i></div><div class="label">Enrolled Students</div><div class="value">${s.students}</div><div class="note">Total enrollment across your classes</div></div>
          <div class="exact-big-card gold"><div class="icon"><i class="fa-solid fa-clock"></i></div><div class="label">Overall Pending Requests</div><div class="value">${s.pending}</div><div class="note">Enrollment requests awaiting action</div></div>
        </div>`;
    } else if(exactView==='profile'){
      const tp=Store?.user?.profile||{};
      panel.innerHTML=`
        <div class="exact-page-head">
          <div class="exact-page-kicker">Profile</div>
          <h2>Welcome ${esc(teacherDisplayName())} to your Dashboard</h2>
          <p>Your account overview and a compact snapshot of your teaching workload.</p>
        </div>
        <div class="exact-mini-stats">
          <div class="exact-mini-card"><strong>${s.classes}</strong><span>Classes</span></div>
          <div class="exact-mini-card"><strong>${s.students}</strong><span>Enrolled Students</span></div>
          <div class="exact-mini-card"><strong>${s.pending}</strong><span>Pending Requests</span></div>
        </div>
        <div class="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <i class="fa-solid fa-id-card"></i>
              </span>
              <div>
                <h3 class="text-base font-black text-slate-800">Teacher Profile</h3>
                <p class="mt-1 text-xs text-slate-500">Read-only account summary. Keep your email active for login and password recovery.</p>
              </div>
            </div>
            <div class="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
              <div class="rounded-xl bg-slate-50 px-4 py-3"><span class="block text-[10px] font-black uppercase tracking-wider text-slate-400">Name</span><b class="mt-1 block text-slate-800">${esc([tp.first_name,tp.last_name].filter(Boolean).join(' ')||'—')}</b></div>
              <div class="rounded-xl bg-slate-50 px-4 py-3"><span class="block text-[10px] font-black uppercase tracking-wider text-slate-400">Department</span><b class="mt-1 block text-slate-800">${esc(tp.department||'—')}</b></div>
              <div class="rounded-xl bg-slate-50 px-4 py-3"><span class="block text-[10px] font-black uppercase tracking-wider text-slate-400">Email</span><b class="mt-1 block break-all text-slate-800">${esc(Store?.user?.email||'—')}</b></div>
            </div>
          </div>
        </div>`;
    } else if(exactView==='notifications'){
      renderNotificationsPanel(panel);
    } else {
      panel.innerHTML='';
    }
  }

  function railHtml(){
    return `
      <div class="exact-brand">
        <strong>Teacher Workspace</strong>
        <span>Teach &nbsp;•&nbsp; Track &nbsp;•&nbsp; Support &nbsp;•&nbsp; Empower</span>
      </div>
      <nav class="exact-primary-nav">
        <button type="button" data-exact-nav="profile"><i class="fa-solid fa-user"></i><span>Profile</span></button>
        <button type="button" data-exact-nav="dashboard"><i class="fa-solid fa-house"></i><span>Dashboard</span></button>
        <button type="button" data-exact-nav="classes" class="active"><i class="fa-solid fa-book-open"></i><span>My Classes</span></button>
        <button type="button" data-exact-nav="notifications"><i class="fa-solid fa-bell"></i><span>Notifications</span>${totals().pending?'<b class="badge">'+(totals().pending>99?'99+':totals().pending)+'</b>':''}</button>
      </nav>
      <div class="exact-rail-footer"><strong>NDC Tagum Foundation, Inc.</strong>Smart Grade & Attendance Portal</div>
    `;
  }

  function rebuildRail(section){
    const rail=section.querySelector('#'+RAIL_ID);
    if(!rail) return;
    rail.classList.add('exact-focus-rail');
    const sig=JSON.stringify(classRows().map(c=>[c.id,c.subject,c.year_level,c.section,c.room_number,c.class_code,c.student_count,c.pending_count]).concat([[selectedClass()?.id||null]]));
    if(rail.dataset.exactSignature===sig) return;
    rail.dataset.exactSignature=sig;
    rail.innerHTML=railHtml();
    rail.querySelectorAll('[data-exact-nav]').forEach(btn=>btn.addEventListener('click',()=>{
      const view=btn.dataset.exactNav;
      if(view==='classes'){
        exactView='classes';
        setExactView('classes');
        document.getElementById('teacher-selected-class-name')?.scrollIntoView({behavior:'smooth',block:'center'});
      } else {
        setExactView(view);
      }
    }));
    syncExactNav();
  }

  function markLegacyBlocks(section){
    const root=section.querySelector(':scope > .space-y-6');
    if(!root) return;

    // Never allow Phase 2 components to inherit a stale legacy-hide marker.
    root.querySelectorAll('.exact-view-panel,.exact-class-strip,.exact-breadcrumbs,.exact-summary-strip')
      .forEach(el=>el.removeAttribute('data-exact-hide'));

    const children=[...root.children].filter(el=>!el.matches('#sg-focus-mobile-nav,.fr-workspace-masthead,.fr-summary-grid,#'+RAIL_ID+',.exact-view-panel,.exact-class-strip,.exact-breadcrumbs,.exact-summary-strip'));
    if(children[0]) children[0].dataset.exactHide='true';
    if(children[1]) children[1].dataset.exactHide='true';
  }

  function ensureClassStrip(section){
    const selectedCard=document.getElementById('teacher-selected-class-name')?.closest('.glass-card');
    const tabsCard=section.querySelector('.sg-ref-tabs')?.closest('.glass-card') || section.querySelector('.sg-ref-tabs')?.parentElement;
    if(!selectedCard && !tabsCard) return;

    let strip=section.querySelector('.exact-class-strip');
    if(!strip){
      strip=document.createElement('section');
      strip.className='exact-class-strip exact-class-workspace';
      if(selectedCard){
        selectedCard.insertAdjacentElement('afterend',strip);
      }else if(tabsCard){
        tabsCard.insertAdjacentElement('beforebegin',strip);
      }
    }

    strip.removeAttribute('data-exact-hide');
    if(exactView==='classes') strip.style.setProperty('display','block','important');

    const rows=classRows();
    const selected=selectedClass();
    const sig=JSON.stringify(rows.map(c=>[
      c.id,c.subject,c.year_level,c.section,c.room_number,c.class_code,
      String(c.id)===String(selected?.id)
    ]));

    if(strip.dataset.sig===sig) return;
    strip.dataset.sig=sig;

    strip.innerHTML=`
      <div class="exact-class-strip-head">
        <div>
          <span class="exact-page-kicker">My Classes</span>
          <strong>${rows.length} class${rows.length===1?'':'es'}</strong>
        </div>
        <button type="button" class="exact-strip-create">
          <i class="fa-solid fa-plus"></i>
          Create Class
        </button>
      </div>
      <div class="exact-class-strip-track">
        ${rows.length ? rows.map(c=>`
          <article class="exact-strip-card ${String(c.id)===String(selected?.id)?'selected':''}" data-class-id="${esc(c.id)}">
                        <button type="button" class="exact-strip-open" data-exact-strip-class="${esc(c.id)}">
              ${String(c.id)===String(selected?.id)?'<div class="exact-selected-ribbon"><i class="fa-solid fa-circle-check"></i><span>Currently Selected</span></div>':''}
              <strong>${esc(c.subject||'Untitled Subject')}</strong>
              <span>${esc(c.year_level||'—')} • ${esc(c.section||'—')}</span>
              <span>Room: ${esc(c.room_number||'—')}</span>
              <small>Class Code: ${esc(c.class_code||'—')}</small>
            </button>
            <button type="button" class="exact-strip-edit" data-exact-strip-edit="${esc(c.id)}" title="Edit class">
              <i class="fa-solid fa-pen-to-square"></i>
              Edit
            </button>
          </article>
        `).join('') : '<div class="exact-strip-empty">No classes yet. Create your first class to begin.</div>'}
      </div>
    `;

    strip.querySelector('.exact-strip-create')?.addEventListener('click',()=>Teacher.showCreateClass());
    strip.querySelectorAll('[data-exact-strip-class]').forEach(btn=>btn.addEventListener('click',()=>Teacher.selectClass(btn.dataset.exactStripClass)));
    strip.querySelectorAll('[data-exact-strip-edit]').forEach(btn=>btn.addEventListener('click',e=>{
      e.stopPropagation();
      Teacher.editClass(btn.dataset.exactStripEdit);
    }));
  }


  function ensureSelectedClassCode(){
    const meta=document.getElementById('teacher-selected-class-meta');
    const c=selectedClass();
    if(!meta || !c) return;
    const parts=[c.year_level,c.section].filter(Boolean);
    const roomText=c.room_number ? 'Room: '+c.room_number : '';
    const codeText=c.class_code ? 'Class Code: '+c.class_code : '';
    const visible=[...parts,roomText,codeText].filter(Boolean).join(' • ');
    const sig=[c.id,visible].join('|');
    if(meta.dataset.exactCodeSig===sig) return;
    meta.dataset.exactCodeSig=sig;
    meta.innerHTML='<span>'+esc(visible)+'</span>'+(c.class_code
      ? ' <button type="button" class="exact-selected-copy" title="Copy class code" aria-label="Copy class code"><i class="fa-regular fa-copy"></i></button>'
      : '')+
      ' <button type="button" class="exact-selected-edit" title="Edit class" aria-label="Edit class"><i class="fa-solid fa-pen-to-square"></i></button>';
    meta.querySelector('.exact-selected-copy')?.addEventListener('click',()=>Teacher.copyClassCode(c.class_code));
    meta.querySelector('.exact-selected-edit')?.addEventListener('click',()=>Teacher.editClass(c.id));
  }

  function ensureBreadcrumbs(section){
    const selectedCard=document.getElementById('teacher-selected-class-name')?.closest('.glass-card');
    if(!selectedCard) return;
    let bc=section.querySelector('.exact-breadcrumbs');
    const c=selectedClass();
    const tab=Teacher?.state?.tab||'gradebook';
    const label=tab==='performance'?'Performance':tab.charAt(0).toUpperCase()+tab.slice(1);
    if(!bc){bc=document.createElement('div');bc.className='exact-breadcrumbs';selectedCard.before(bc)}
    const sig=[c?.id,c?.subject,c?.section,label].join('|');
    if(bc.dataset.sig===sig) return;
    bc.dataset.sig=sig;
    bc.innerHTML='<span>My Classes</span><i class="fa-solid fa-chevron-right"></i><span>'+(c?.subject||'Selected Class')+(c?.section?' — '+c.section:'')+'</span><i class="fa-solid fa-chevron-right"></i><span>'+label+'</span>';
  }

  function ensureSummary(){
    const tabs=document.querySelector('#teacher-section .sg-ref-tabs');
    const box=document.getElementById('teacher-tab-content');
    if(!tabs || !box) return;
    let strip=document.querySelector('#teacher-section .exact-summary-strip');
    if(Teacher?.state?.tab!=='gradebook'){strip?.remove();return}
    const c=selectedClass();
    if(!strip){strip=document.createElement('section');strip.className='exact-summary-strip';tabs.after(strip)}
    const sig=[c?.id,c?.student_count,c?.pending_count].join('|');
    if(strip.dataset.sig===sig) return;
    strip.dataset.sig=sig;
    strip.innerHTML='<div><i class="fa-solid fa-user-group"></i><span><strong>'+Number(c?.student_count||0)+'</strong><small>Enrolled Students</small></span></div>'+
      '<div><i class="fa-solid fa-clock"></i><span><strong>'+Number(c?.pending_count||0)+'</strong><small>Pending Approvals</small></span></div>'+
      '<div><i class="fa-solid fa-pen-to-square"></i><span><strong>Grading in Progress</strong><small>You can encode and update grades.</small></span></div>'+
      '<div><span class="save-dot"></span><span><strong>Server-backed</strong><small>Current academic data</small></span></div>';
  }

  function filterByStatus(select){
    const table=document.getElementById('teacher-grade-table');
    if(!table) return;
    const value=select.value;
    table.querySelectorAll('tbody tr').forEach(row=>{
      const text=(row.textContent||'').toLowerCase();
      const keep=value==='all'||(value==='released'?text.includes('released'):value==='finalized'?text.includes('finalized'):!text.includes('released')&&!text.includes('finalized'));
      row.style.display=keep?'':'none';
    });
  }

  function exportCurrentTable(){
    const table=document.getElementById('teacher-grade-table');if(!table)return;
    const rows=[...table.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>'"'+(td.innerText||'').replace(/"/g,'""').replace(/\s+/g,' ').trim()+'"').join(','));
    const blob=new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gradebook-export.csv';a.click();URL.revokeObjectURL(a.href);
  }

  function decorateGradebookExact(){
    if(Teacher?.state?.tab!=='gradebook') return;
    const table=document.getElementById('teacher-grade-table');if(!table)return;
    const wrapper=table.parentElement;if(wrapper)wrapper.classList.add('exact-grade-panel');
    const host=table.closest('.space-y-4');const toolbar=host?.firstElementChild;if(!toolbar)return;
    if(!toolbar.querySelector('.exact-filter-wrap')){
      const filter=document.createElement('label');filter.className='exact-filter-wrap';
      filter.innerHTML='<span>Status</span><select><option value="all">All Students</option><option value="progress">In Progress</option><option value="finalized">Finalized</option><option value="released">Released</option></select>';
      toolbar.appendChild(filter);filter.querySelector('select').addEventListener('change',e=>filterByStatus(e.target));
    }
    if(!toolbar.querySelector('.exact-export-btn')){
      const btn=document.createElement('button');btn.type='button';btn.className='exact-export-btn';btn.innerHTML='<i class="fa-solid fa-download mr-2"></i>Export';
      btn.addEventListener('click',exportCurrentTable);toolbar.appendChild(btn);
    }
    if(wrapper && !wrapper.previousElementSibling?.classList?.contains('exact-grade-title')){
      const title=document.createElement('div');title.className='exact-grade-title';
      const n=table.querySelectorAll('tbody tr').length;
      title.innerHTML='<div><h3>Gradebook</h3><p>Columns follow the active grading system for this class.</p></div><span>Showing '+n+' learner'+(n===1?'':'s')+'</span>';
      wrapper.before(title);
    }
  }

  function decorate(){
    const section=document.getElementById('teacher-section');
    if(!teacherVisible()){restoreHeader();return}
    section.classList.add(ROOT_CLASS);
    decorateHeader();
    rebuildRail(section);
    markLegacyBlocks(section);
    ensureSelectedClassCode();
    ensureClassStrip(section);
    ensureBreadcrumbs(section);
    ensureSummary();
    decorateGradebookExact();
    markWorkspace();
    renderExactView();
    syncExactNav();
  }

  let queued=false;
  const queue=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})};
  new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('load',queue);
  queue();
})();
