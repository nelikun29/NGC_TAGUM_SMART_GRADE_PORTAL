(() => {
  'use strict';

  const STYLE_ID='ndc-mobile-v3-style';
  const NAV_ID='ndc-teacher-mobile-nav';

  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      @media (max-width: 820px){
        html,body{max-width:100%;overflow-x:hidden}
        body{padding-bottom:86px!important;background:#f5f8fc!important}
        .portal-header{position:sticky!important;top:0!important;z-index:45!important}
        .portal-header .max-w-7xl{padding-left:12px!important;padding-right:12px!important}
        .portal-header img{width:34px!important;height:34px!important}
        .portal-header h1,.portal-header .text-xl{font-size:.92rem!important;line-height:1.15!important}
        #user-header-profile{max-width:132px!important}
        #user-name-display{max-width:90px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        #logout-btn{min-height:38px!important;padding:0 11px!important}

        /* Teacher: replace desktop rail with bottom navigation */
        #sg-focus-rail.exact-focus-rail{display:none!important}
        #teacher-section.sg-focus-rail-active.sg-exact-focus-prototype:not(.hidden) > .space-y-6{
          margin:0!important;
          padding:12px 12px 28px!important;
          width:100%!important;
          min-width:0!important;
        }
        #teacher-section.sg-exact-focus-prototype .exact-breadcrumbs{display:none!important}

        #ndc-teacher-mobile-nav{
          position:fixed;left:10px;right:10px;bottom:max(10px,env(safe-area-inset-bottom));z-index:120;
          display:grid;grid-template-columns:repeat(3,1fr);gap:4px;
          padding:7px;border:1px solid rgba(255,255,255,.65);border-radius:18px;
          background:rgba(9,38,76,.94);backdrop-filter:blur(18px) saturate(135%);
          -webkit-backdrop-filter:blur(18px) saturate(135%);
          box-shadow:0 18px 36px rgba(15,23,42,.24)
        }
        #ndc-teacher-mobile-nav button{
          position:relative;min-height:54px;padding:5px 4px;border:0;border-radius:12px;background:transparent!important;
          color:#c6d5e7!important;font-size:10px;font-weight:800;line-height:1.15
        }
        #ndc-teacher-mobile-nav button i{display:block;margin:0 auto 5px;font-size:16px}
        #ndc-teacher-mobile-nav button.active{background:rgba(255,255,255,.13)!important;color:#fff!important}
        #ndc-teacher-mobile-nav button.active::after{
          content:"";position:absolute;left:25%;right:25%;bottom:3px;height:3px;border-radius:999px;background:#f3c742
        }
        #ndc-teacher-mobile-nav .mobile-badge{
          position:absolute;top:4px;right:12px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;
          display:grid;place-items:center;background:#ef4444;color:#fff;font-size:9px;font-weight:900
        }

        /* Selected class header */
        #teacher-section.sg-exact-focus-prototype .sg-ref-selected{
          padding:13px!important;border:1px solid #dbe4ef!important;border-radius:14px!important;
          background:#fff!important;box-shadow:0 8px 20px rgba(15,23,42,.05)!important
        }
        #teacher-section.sg-exact-focus-prototype .sg-ref-selected > div{
          display:flex!important;flex-direction:column!important;gap:12px!important;align-items:stretch!important
        }
        #teacher-section.sg-exact-focus-prototype .sg-ref-selected > div > div:first-child{padding-left:13px!important}
        #teacher-section.sg-exact-focus-prototype #teacher-selected-class-name{
          font-size:1.02rem!important;line-height:1.25!important
        }
        #teacher-section.sg-exact-focus-prototype #teacher-selected-class-meta{
          font-size:.69rem!important;line-height:1.45!important
        }
        #teacher-section.sg-exact-focus-prototype .sg-ref-selected select{
          width:100%!important;min-width:0!important;height:46px!important;font-size:.72rem!important
        }
        #teacher-section.sg-exact-focus-prototype .sg-ref-selected label{display:block!important;margin-bottom:5px!important}

        /* Class cards */
        .exact-class-strip{padding:12px!important;margin:12px 0!important;border-radius:14px!important}
        .exact-class-strip-head{align-items:center!important;gap:10px!important}
        .exact-class-strip-head>div{display:block!important}
        .exact-class-strip-head .exact-page-kicker{display:block!important}
        .exact-strip-create{min-height:42px!important;padding:0 12px!important;white-space:nowrap!important}
        .exact-class-strip-track{
          display:flex!important;gap:10px!important;overflow-x:auto!important;scroll-snap-type:x mandatory!important;
          -webkit-overflow-scrolling:touch!important;padding:3px 2px 8px!important
        }
        .exact-strip-card{flex:0 0 min(82vw,300px)!important;scroll-snap-align:start!important}
        .exact-strip-card:hover{transform:none!important}
        .exact-strip-card.selected{transform:none!important}
        .exact-strip-open{padding:16px 13px 44px!important}
        .exact-selected-ribbon{margin-bottom:9px!important}

        /* Teacher class workspace tabs */
        #teacher-section.sg-exact-focus-prototype .sg-ref-tabs{
          position:sticky!important;top:58px!important;z-index:34!important;
          overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;
          background:rgba(255,255,255,.97)!important;box-shadow:0 4px 14px rgba(15,23,42,.05)!important
        }
        #teacher-section.sg-exact-focus-prototype .sg-ref-tabs .tab-btn{
          min-height:48px!important;padding:0 14px!important;font-size:.68rem!important
        }

        .exact-summary-strip{grid-template-columns:1fr 1fr!important;margin:12px 0!important}
        .exact-summary-strip>div{min-height:66px!important;padding:10px 12px!important}
        .exact-summary-strip>div:nth-child(2){border-right:0!important}
        .exact-summary-strip>div:nth-child(-n+2){border-bottom:1px solid var(--efr-line)!important}

        /* Gradebook and assessment workspace */
        #teacher-tab-content{min-width:0!important}
        #teacher-tab-content .space-y-4 > div:first-child{
          grid-template-columns:1fr!important;gap:9px!important;margin-bottom:12px!important
        }
        #teacher-grade-filter,.exact-filter-wrap select,.exact-export-btn{
          width:100%!important;height:44px!important;min-height:44px!important
        }
        .exact-filter-wrap{grid-template-columns:1fr!important;gap:5px!important}
        .exact-grade-panel{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;border-radius:12px!important}
        #teacher-grade-table{min-width:980px!important}
        .exact-grade-title{align-items:flex-start!important;gap:8px!important}
        .exact-grade-title h3{font-size:1rem!important}

        /* Score-entry rows: touch-friendly */
        #teacher-tab-content input[type="number"]{min-height:44px!important;font-size:16px!important}
        #teacher-tab-content button{min-height:42px}
        #teacher-tab-content .glass-card{border-radius:14px!important}
        #teacher-tab-content .space-y-2 > .border-b{
          padding:13px 0!important;gap:10px!important
        }

        /* Profile / dashboard / notifications */
        .exact-page-head{margin:4px 0 14px!important}
        .exact-page-head h2{font-size:1.35rem!important;line-height:1.2!important}
        .exact-big-stats,.exact-mini-stats{grid-template-columns:1fr!important;gap:10px!important}
        .exact-big-card{min-height:auto!important;padding:17px!important}
        .exact-notification-card{grid-template-columns:1fr!important;padding:14px!important}
        .exact-notification-actions{display:grid!important;grid-template-columns:1fr 1fr!important}
        .exact-notification-actions button{min-height:44px!important}

        /* Student */
        #student-section:not(.hidden){
          width:100%!important;max-width:none!important;padding:12px!important;margin:0!important
        }
        #student-section .glass-card{border-radius:14px!important}
        #student-section .grid{gap:10px!important}
        #student-section button,#student-section a{min-height:44px}
        #student-section input,#student-section select{min-height:44px!important;font-size:16px!important}
        #student-section table{min-width:700px}
        #student-section .overflow-x-auto{border-radius:12px!important;-webkit-overflow-scrolling:touch!important}

        /* Admin */
        #admin-section:not(.hidden){
          width:100%!important;max-width:none!important;padding:12px!important;margin:0!important
        }
        #admin-section > .flex:first-child{gap:8px!important}
        #admin-section .glass-card{border-radius:14px!important}
        #admin-section .tab-btn{min-height:44px!important;padding:0 14px!important;white-space:nowrap!important}
        #admin-section .border-b.overflow-x-auto{
          position:sticky!important;top:58px!important;z-index:32!important;background:#fff!important;
          -webkit-overflow-scrolling:touch!important
        }
        #admin-section table{min-width:760px!important}
        #admin-section .overflow-x-auto{-webkit-overflow-scrolling:touch!important}
        #admin-section button{min-height:40px}

        /* Toasts */
        #toast-container{
          left:12px!important;right:12px!important;bottom:calc(88px + env(safe-area-inset-bottom))!important;
          width:auto!important;max-width:none!important
        }

        /* Modals */
        .fixed.inset-0{padding:12px!important}
        .fixed.inset-0 > .relative,
        .fixed.inset-0 > div:not(.absolute){max-height:88vh;overflow-y:auto}

        @media (max-width:430px){
          .portal-header .max-w-7xl{gap:8px!important}
          .exact-class-strip-head{flex-direction:column!important;align-items:stretch!important}
          .exact-strip-create{width:100%!important}
          .exact-summary-strip{grid-template-columns:1fr!important}
          .exact-summary-strip>div{border-right:0!important;border-bottom:1px solid var(--efr-line)!important}
          .exact-summary-strip>div:last-child{border-bottom:0!important}
          .exact-notification-actions{grid-template-columns:1fr!important}
        }
      }
    `;
    document.head.appendChild(style);
  }

  function teacherVisible(){
    const section=document.getElementById('teacher-section');
    return section && !section.classList.contains('hidden');
  }

  function syncTeacherNav(){
    const nav=document.getElementById(NAV_ID);
    if(!nav) return;
    const section=document.getElementById('teacher-section');
    const view=section?.dataset?.exactView || 'classes';
    nav.querySelectorAll('[data-mobile-view]').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.mobileView===view);
    });
    const pending=Number((typeof Teacher!=='undefined' && Array.isArray(Teacher._classes))
      ? Teacher._classes.reduce((n,c)=>n+Number(c.pending_count||0),0)
      : 0);
    const badge=nav.querySelector('.mobile-badge');
    if(badge){
      badge.textContent=pending>99?'99+':String(pending);
      badge.style.display=pending>0?'grid':'none';
    }
  }

  function ensureTeacherNav(){
    if(window.innerWidth>820 || !teacherVisible()){
      document.getElementById(NAV_ID)?.remove();
      return;
    }

    let nav=document.getElementById(NAV_ID);
    if(!nav){
      nav=document.createElement('nav');
      nav.id=NAV_ID;
      nav.setAttribute('aria-label','Teacher mobile navigation');
      nav.innerHTML=`
        <button type="button" data-mobile-view="overview"><i class="fa-solid fa-house-user"></i><span>Overview</span></button>
        <button type="button" data-mobile-view="classes"><i class="fa-solid fa-book-open"></i><span>My Classes</span></button>
        <button type="button" data-mobile-view="notifications"><i class="fa-solid fa-bell"></i><span>Notifications</span><b class="mobile-badge" style="display:none">0</b></button>
      `;
      document.body.appendChild(nav);
      nav.querySelectorAll('[data-mobile-view]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const target=document.querySelector('#sg-focus-rail [data-exact-nav="'+btn.dataset.mobileView+'"]');
          if(target) target.click();
          setTimeout(syncTeacherNav,0);
        });
      });
    }
    syncTeacherNav();
  }

  let queued=false;
  const refresh=()=>{
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      ensureTeacherNav();
    });
  };

  window.addEventListener('resize',refresh,{passive:true});
  window.addEventListener('load',refresh);
  new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-exact-view']});
  refresh();
})();