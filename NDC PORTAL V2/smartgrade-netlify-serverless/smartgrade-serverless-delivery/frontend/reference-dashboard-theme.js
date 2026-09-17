// Reference-inspired Student + Teacher dashboard visual system.
// Presentation only: no API, grading, auth, permissions, or data behavior changes.
(() => {
  const style = document.createElement('style');
  style.id = 'sg-reference-dashboard-theme';
  style.textContent = `
    :root{--sg-navy:#0b2457;--sg-blue:#2563eb;--sg-sky:#38bdf8;--sg-violet:#7c3aed;--sg-gold:#d4a72c;--sg-gold-light:#f6d66f;--sg-deep:#071a3d;--sg-line:rgba(148,163,184,.22);--sg-shadow:0 22px 55px rgba(30,64,175,.12),0 8px 22px rgba(15,23,42,.06)}
    #student-section,#teacher-section{position:relative;color:#172554}
    #student-section::before{content:"";position:fixed;inset:0;z-index:-2;background:radial-gradient(circle at 8% 14%,rgba(56,189,248,.17),transparent 27%),radial-gradient(circle at 42% 8%,rgba(129,140,248,.13),transparent 28%),radial-gradient(circle at 92% 82%,rgba(139,92,246,.12),transparent 30%),linear-gradient(135deg,#f8fcff 0%,#f3f7ff 48%,#fffdf8 100%);pointer-events:none}
    #student-section::after{content:"";position:fixed;right:-12vw;top:-15vw;width:42vw;height:42vw;border-radius:50%;z-index:-1;background:linear-gradient(145deg,rgba(96,165,250,.10),rgba(139,92,246,.05));pointer-events:none}
    #student-section .glass-card{background:linear-gradient(145deg,rgba(255,255,255,.88),rgba(248,250,252,.72));border:1px solid rgba(191,219,254,.72);box-shadow:var(--sg-shadow);backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%)}
    #student-section h2,#student-section h3,#student-section h4{color:#10285d;letter-spacing:-.018em}
    .sg-ref-heading{display:flex!important;align-items:center!important;gap:.65rem!important;margin-bottom:.25rem!important}
    #student-section .sg-ref-heading::before{content:"";display:inline-flex;width:30px;height:30px;border-radius:8px;background:linear-gradient(145deg,#2563eb,#4f46e5);box-shadow:0 8px 18px rgba(37,99,235,.25)}
    .sg-ref-heading + p{color:#64748b!important}

    /* Student profile / utility column */
    #student-section .sg-ref-profile{border-radius:24px!important;border:1px solid rgba(191,219,254,.8)!important;background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(239,246,255,.76))!important;box-shadow:0 24px 55px rgba(37,99,235,.12)!important;overflow:hidden;position:relative}
    #student-section .sg-ref-profile::before{content:"";position:absolute;inset:0 0 auto;height:5px;background:linear-gradient(90deg,#38bdf8,#2563eb,#7c3aed)}
    #student-section .sg-ref-join{background:linear-gradient(145deg,rgba(224,242,254,.78),rgba(239,246,255,.92))!important;border:1px solid rgba(186,230,253,.9)!important;border-radius:18px!important}
    #student-section .sg-ref-attendance{background:linear-gradient(145deg,rgba(255,247,237,.88),rgba(254,249,195,.58))!important;border:1px solid rgba(253,230,138,.85)!important;border-radius:18px!important}
    #student-section input,#student-section select{border-radius:13px!important;border:1px solid #cbd5e1!important;background:rgba(255,255,255,.94)!important;box-shadow:inset 0 1px 2px rgba(15,23,42,.03);transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}
    #student-section input:focus,#student-section select:focus{border-color:#60a5fa!important;box-shadow:0 0 0 4px rgba(59,130,246,.12)!important;outline:none!important}
    #student-section button{transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}
    #student-section button:hover{transform:translateY(-1px)}

    /* Student class card inspired by supplied reference */
    #student-section .sg-student-class-card{position:relative!important;overflow:hidden!important;border-radius:22px!important;border:1px solid rgba(129,140,248,.62)!important;border-left:1px solid rgba(129,140,248,.62)!important;background:linear-gradient(155deg,rgba(255,255,255,.94),rgba(248,250,252,.86))!important;box-shadow:0 25px 58px rgba(37,99,235,.17),0 8px 22px rgba(15,23,42,.07)!important;backdrop-filter:blur(22px) saturate(155%);-webkit-backdrop-filter:blur(22px) saturate(155%);transition:transform .22s ease,box-shadow .22s ease}
    #student-section .sg-student-class-card::before{content:"";display:block;height:8px;margin:-1.25rem -1.25rem 1rem;background:linear-gradient(90deg,#7c3aed 0%,#3b82f6 38%,#2563eb 68%,#7c3aed 100%);box-shadow:0 7px 24px rgba(79,70,229,.22)}
    #student-section .sg-student-class-card:hover{transform:translateY(-4px);box-shadow:0 32px 70px rgba(37,99,235,.21),0 12px 28px rgba(15,23,42,.08)!important}
    #student-section .sg-student-class-card h4{font-size:1.15rem!important;font-weight:900!important;color:#10285d!important}
    #student-section .sg-student-class-card .bg-emerald-50,#student-section .sg-student-class-card [class*="bg-green"]{background:linear-gradient(90deg,rgba(209,250,229,.72),rgba(236,253,245,.72))!important}
    #student-section .sg-student-class-card .bg-blue-50{background:linear-gradient(90deg,rgba(219,234,254,.75),rgba(239,246,255,.78))!important}
    #student-section .sg-student-class-card .bg-amber-50{background:linear-gradient(90deg,rgba(254,243,199,.68),rgba(255,247,237,.78))!important}
    #student-section .sg-student-class-card .bg-violet-50,#student-section .sg-student-class-card .bg-purple-50{background:linear-gradient(90deg,rgba(237,233,254,.76),rgba(245,243,255,.82))!important}
    #student-section .sg-student-pending-card{border-radius:22px!important;box-shadow:var(--sg-shadow)!important}
    #student-section .sg-class-gallery{background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important}
    #student-section .sg-class-gallery .sg-gallery-heading h3,#student-section .sg-class-gallery .sg-gallery-heading p{color:inherit!important}

    /* Teacher: premium dark navy + gold glass system */
    #teacher-section{color:#e8eefc}
    #teacher-section::before{content:"";position:fixed;inset:0;z-index:-2;background:radial-gradient(circle at 12% 12%,rgba(37,78,143,.38),transparent 30%),radial-gradient(circle at 88% 10%,rgba(212,167,44,.14),transparent 24%),radial-gradient(circle at 78% 82%,rgba(32,72,132,.28),transparent 30%),linear-gradient(135deg,#06152f 0%,#0a2148 48%,#071a36 100%);pointer-events:none}
    #teacher-section::after{content:"";position:fixed;right:-10vw;top:-13vw;width:40vw;height:40vw;border-radius:50%;z-index:-1;border:1px solid rgba(246,214,111,.12);background:linear-gradient(145deg,rgba(212,167,44,.08),rgba(255,255,255,.015));box-shadow:0 0 90px rgba(212,167,44,.05);pointer-events:none}
    #teacher-section h2,#teacher-section h3,#teacher-section h4{letter-spacing:-.018em}
    #teacher-section>.glass-card,#teacher-section .sg-ref-selected,#teacher-section .sg-ref-tabs,#teacher-tab-content .glass-card{backdrop-filter:blur(22px) saturate(135%);-webkit-backdrop-filter:blur(22px) saturate(135%)}
    #teacher-section .sg-ref-heading::before{content:"";display:inline-flex;width:30px;height:30px;border-radius:8px;background:linear-gradient(145deg,#f6d66f,#b88618);box-shadow:0 8px 22px rgba(212,167,44,.28)}
    #teacher-section .sg-ref-heading,#teacher-section .sg-ref-heading h3{color:#fff!important}
    #teacher-section .sg-ref-heading + p{color:#b8c6df!important}

    /* Teacher selected class */
    #teacher-section .sg-ref-selected{position:relative!important;overflow:hidden!important;border-radius:22px!important;background:linear-gradient(120deg,rgba(11,36,87,.88),rgba(17,48,99,.72))!important;border:1px solid rgba(246,214,111,.32)!important;box-shadow:0 24px 58px rgba(1,9,25,.36),inset 0 1px 0 rgba(255,255,255,.08)!important}
    #teacher-section .sg-ref-selected::before{content:"";position:absolute;inset:0 auto 0 0;width:7px;background:linear-gradient(180deg,#f6d66f,#b88618)}
    #teacher-section .sg-ref-selected::after{content:"";position:absolute;right:-80px;top:-90px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(246,214,111,.13),transparent 68%);pointer-events:none}
    #teacher-section .sg-ref-selected h2,#teacher-section .sg-ref-selected h3,#teacher-section .sg-ref-selected h4,#teacher-section .sg-ref-selected #teacher-selected-class-name{color:#fff!important}
    #teacher-section .sg-ref-selected p,#teacher-section .sg-ref-selected label{color:#b9c8e2!important}
    #teacher-section .sg-ref-selected select{background:rgba(255,255,255,.10)!important;border-color:rgba(246,214,111,.32)!important;color:#fff!important}
    #teacher-section .sg-ref-selected select option{color:#0f172a;background:#fff}

    /* Teacher navigation */
    #teacher-section .sg-ref-tabs{border-radius:20px 20px 0 0!important;background:linear-gradient(180deg,rgba(10,32,70,.88),rgba(7,25,56,.82))!important;border:1px solid rgba(246,214,111,.20)!important;box-shadow:0 16px 38px rgba(1,9,25,.28),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(20px)}
    #teacher-section .tab-btn{position:relative;border-radius:12px 12px 0 0!important;color:#c6d2e8!important;font-weight:800!important;transition:background .18s ease,color .18s ease,transform .18s ease}
    #teacher-section .tab-btn:hover{background:rgba(246,214,111,.08)!important;color:#f6d66f!important;transform:translateY(-1px)}
    #teacher-section .tab-btn.active{color:#f6d66f!important;background:linear-gradient(180deg,rgba(212,167,44,.13),rgba(255,255,255,.025))!important}
    #teacher-section .tab-btn.active::after{content:"";position:absolute;left:18%;right:18%;bottom:-1px;height:3px;border-radius:999px;background:linear-gradient(90deg,#b88618,#f6d66f,#b88618);box-shadow:0 0 12px rgba(246,214,111,.30)}

    /* Teacher class cards */
    #teacher-section article{border-radius:22px!important;border:1px solid rgba(246,214,111,.24)!important;background:linear-gradient(145deg,rgba(11,36,87,.82),rgba(7,26,61,.70))!important;box-shadow:0 22px 52px rgba(1,9,25,.34),inset 0 1px 0 rgba(255,255,255,.07)!important;backdrop-filter:blur(20px) saturate(135%);-webkit-backdrop-filter:blur(20px) saturate(135%);transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease!important}
    #teacher-section article:hover{transform:translateY(-4px)!important;border-color:rgba(246,214,111,.48)!important;box-shadow:0 30px 68px rgba(1,9,25,.42),0 0 24px rgba(212,167,44,.08)!important}
    #teacher-section article>div:first-child{background-image:linear-gradient(120deg,#071a3d 0%,#0d326b 58%,#8d6815 130%)!important;border-bottom:1px solid rgba(246,214,111,.24)}
    #teacher-section article h4{color:#fff!important}
    #teacher-section article p,#teacher-section article code{color:#d8e2f3!important}
    #teacher-section article button{transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}
    #teacher-section article button:hover{transform:translateY(-1px)}
    #teacher-section article button[onclick*="selectClass"]{background:linear-gradient(135deg,#d4a72c,#b88618)!important;color:#071a3d!important;box-shadow:0 9px 22px rgba(212,167,44,.22)!important}
    #teacher-section article button[onclick*="editClass"]{background:rgba(255,255,255,.07)!important;border-color:rgba(246,214,111,.25)!important;color:#f6d66f!important}
    #teacher-section article button[onclick*="openStudents"]{background:rgba(23,62,119,.55)!important;border:1px solid rgba(113,151,207,.18)}
    #teacher-section article button[onclick*="openApprovals"]{background:rgba(212,167,44,.11)!important;border:1px solid rgba(246,214,111,.20)}

    /* Teacher working surface: light translucent workspace over dark shell */
    #teacher-tab-content{background:linear-gradient(145deg,rgba(247,250,255,.94),rgba(235,241,249,.89))!important;border:1px solid rgba(246,214,111,.16);border-top:0;border-radius:0 0 20px 20px;color:#172033;box-shadow:0 24px 55px rgba(1,9,25,.24);backdrop-filter:blur(20px)}
    #teacher-tab-content h2,#teacher-tab-content h3,#teacher-tab-content h4{color:#0b2457!important}
    #teacher-tab-content .glass-card{border-radius:18px!important;background:linear-gradient(145deg,rgba(255,255,255,.86),rgba(244,247,252,.72))!important;border:1px solid rgba(180,193,213,.48)!important;box-shadow:0 14px 34px rgba(7,26,61,.08),inset 0 1px 0 rgba(255,255,255,.85)!important}
    #teacher-tab-content table{border-collapse:separate!important;border-spacing:0!important;background:rgba(255,255,255,.78);border:1px solid rgba(180,193,213,.40);border-radius:16px;overflow:hidden;box-shadow:0 10px 28px rgba(7,26,61,.06)}
    #teacher-tab-content thead th{background:linear-gradient(180deg,#0b2a5b,#071a3d)!important;color:#f6d66f!important;font-size:.68rem!important;letter-spacing:.055em;text-transform:uppercase;border-color:rgba(246,214,111,.14)!important}
    #teacher-tab-content tbody tr{transition:background .16s ease}
    #teacher-tab-content tbody tr:hover{background:rgba(246,214,111,.09)!important}
    #teacher-tab-content input,#teacher-tab-content select,#teacher-tab-content textarea{border-radius:11px!important;border-color:#b9c5d8!important;background:rgba(255,255,255,.92)!important;color:#172033!important}
    #teacher-tab-content input:focus,#teacher-tab-content select:focus,#teacher-tab-content textarea:focus{outline:none!important;border-color:#d4a72c!important;box-shadow:0 0 0 4px rgba(212,167,44,.14)!important}
    #teacher-section button:focus-visible{outline:3px solid rgba(246,214,111,.42)!important;outline-offset:3px}
    #student-section button:focus-visible{outline:3px solid rgba(59,130,246,.24)!important;outline-offset:3px}

    /* Flexible grading: navy/gold identity while retaining readable fields */
    #teacher-section .sg-dg-panel{border-radius:22px!important;background:linear-gradient(145deg,rgba(255,255,255,.91),rgba(241,245,249,.82))!important;border:1px solid rgba(212,167,44,.35)!important;box-shadow:0 18px 42px rgba(7,26,61,.12)!important}
    #teacher-section .sg-dg-intro{border-radius:18px!important;background:linear-gradient(135deg,rgba(11,36,87,.96),rgba(18,54,108,.90))!important;border-color:rgba(246,214,111,.26)!important;color:#fff!important}
    #teacher-section .sg-dg-intro h3,#teacher-section .sg-dg-intro .text-slate-900{color:#fff!important}
    #teacher-section .sg-dg-intro p,#teacher-section .sg-dg-intro .text-slate-500{color:#c7d3e7!important}
    #teacher-section .sg-dg-state{background:linear-gradient(135deg,#fff3bf,#f6d66f)!important;border-color:#d4a72c!important;color:#684c08!important;box-shadow:0 7px 18px rgba(212,167,44,.18)}
    #teacher-section .sg-dg-primary{background:linear-gradient(135deg,#d4a72c,#b88618)!important;color:#071a3d!important;box-shadow:0 9px 20px rgba(212,167,44,.23)}
    #teacher-section .sg-dg-secondary{background:#0b2a5b!important;color:#fff!important;border:1px solid rgba(246,214,111,.18)!important}

    @media(max-width:900px){#student-section .sg-ref-profile{border-radius:20px!important}.sg-ref-heading{font-size:1.1rem!important}#teacher-section .sg-ref-tabs{overflow-x:auto!important;scrollbar-width:thin}}
    @media(max-width:640px){#student-section::after,#teacher-section::after{display:none}#student-section .sg-student-class-card,#teacher-section article{border-radius:18px!important}#student-section .sg-student-class-card::before{margin:-1.25rem -1.25rem .85rem}#teacher-tab-content{border-radius:0 0 16px 16px}#student-section .sg-ref-heading::before,#teacher-section .sg-ref-heading::before{width:25px;height:25px;border-radius:7px}}
    @media(prefers-reduced-motion:reduce){#student-section *,#teacher-section *{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}
  `;
  document.head.appendChild(style);

  const textIs = (el, value) => (el?.textContent || '').trim().toLowerCase() === value;
  function decorateStudent(){
    const section=document.getElementById('student-section'); if(!section)return;
    const heading=[...section.querySelectorAll('h2,h3')].find(el=>textIs(el,'my classes & grades'));
    heading?.classList.add('sg-ref-heading');
    const joinHeading=[...section.querySelectorAll('h3,h4')].find(el=>(el.textContent||'').trim().toLowerCase().includes('join a class'));
    const joinCard=joinHeading?.closest('.glass-card')||joinHeading?.parentElement?.parentElement; joinCard?.classList.add('sg-ref-join');
    const attHeading=[...section.querySelectorAll('h3,h4')].find(el=>(el.textContent||'').trim().toLowerCase().includes('submit attendance'));
    const attCard=attHeading?.closest('.glass-card')||attHeading?.parentElement?.parentElement; attCard?.classList.add('sg-ref-attendance');
    const profileCandidate=joinCard?.parentElement;
    if(profileCandidate && profileCandidate!==section) profileCandidate.classList.add('sg-ref-profile');
    section.querySelectorAll('.sg-student-class-card').forEach(card=>card.setAttribute('data-reference-theme','true'));
  }
  function decorateTeacher(){
    const section=document.getElementById('teacher-section'); if(!section)return;
    const selected=document.getElementById('teacher-selected-class-name');
    selected?.closest('.glass-card')?.classList.add('sg-ref-selected');
    const tabContent=document.getElementById('teacher-tab-content');
    tabContent?.previousElementSibling?.classList.add('sg-ref-tabs');
    const heading=[...section.querySelectorAll('h2,h3')].find(el=>textIs(el,'my classes'));
    heading?.classList.add('sg-ref-heading');
  }
  let queued=false;
  function decorate(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorateStudent();decorateTeacher();});}
  decorate();
  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
})();
