// Teacher class-card premium visual layer.
// Presentation only; existing class actions and data behavior are preserved.
(() => {
  if (typeof Teacher === 'undefined') return;
  const css=document.createElement('style');
  css.id='sg-teacher-class-card-enhancement';
  css.textContent=`
  #teacher-section .sg-teacher-class-gallery{position:relative;margin-bottom:18px;padding:18px 20px;border-radius:20px;border:1px solid rgba(246,214,111,.25);background:linear-gradient(125deg,rgba(7,26,61,.96),rgba(11,47,104,.91) 62%,rgba(125,91,18,.76));box-shadow:0 20px 46px rgba(1,9,25,.30),inset 0 1px 0 rgba(255,255,255,.09);overflow:hidden}
  #teacher-section .sg-teacher-class-gallery::after{content:"";position:absolute;right:-55px;top:-100px;width:210px;height:210px;border-radius:50%;border:1px solid rgba(246,214,111,.20);background:radial-gradient(circle,rgba(246,214,111,.12),transparent 67%);pointer-events:none}
  #teacher-section .sg-teacher-class-gallery h3,#teacher-section .sg-teacher-class-gallery h2{color:#fff!important}
  #teacher-section .sg-teacher-dashboard-icon{width:44px!important;height:44px!important;min-width:44px!important;flex:0 0 44px!important;display:flex!important;align-items:center!important;justify-content:center!important;border-radius:14px!important;background:#eff6ff!important;border:1px solid rgba(96,165,250,.38)!important;box-shadow:0 8px 20px rgba(37,99,235,.14)!important;color:#1d4ed8!important;position:relative!important;inset:auto!important;transform:none!important;margin:0!important}
  #teacher-section .sg-teacher-dashboard-icon i{display:block!important;width:auto!important;height:auto!important;margin:0!important;font-size:18px!important;line-height:1!important;color:#1d4ed8!important;background:transparent!important;transform:none!important}
  #teacher-section .sg-teacher-class-gallery p{color:#c7d4e8!important}
  #teacher-section article.sg-teacher-premium-card{--sg-card-a:#041a42;--sg-card-b:#063b82;--sg-card-c:#0a65c8;--sg-card-accent:#e7b52f;--sg-card-glow:rgba(255,210,82,.30);padding:0!important;overflow:hidden!important;border-radius:24px!important;border:1px solid color-mix(in srgb,var(--sg-card-accent) 42%,transparent)!important;background:linear-gradient(150deg,rgba(11,36,87,.90),rgba(7,26,61,.82))!important;box-shadow:0 25px 58px rgba(1,9,25,.32),0 8px 22px color-mix(in srgb,var(--sg-card-accent) 10%,transparent),inset 0 1px 0 rgba(255,255,255,.07)!important;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease!important}
  #teacher-section article.sg-teacher-premium-card.sg-theme-blue{--sg-card-a:#041a42;--sg-card-b:#0752a6;--sg-card-c:#1684df;--sg-card-accent:#f2c94c;--sg-card-glow:rgba(96,165,250,.34)}
  #teacher-section article.sg-teacher-premium-card.sg-theme-emerald{--sg-card-a:#052e2b;--sg-card-b:#087f5b;--sg-card-c:#10b981;--sg-card-accent:#f2c94c;--sg-card-glow:rgba(52,211,153,.32)}
  #teacher-section article.sg-teacher-premium-card.sg-theme-violet{--sg-card-a:#26124f;--sg-card-b:#6431a8;--sg-card-c:#8b5cf6;--sg-card-accent:#f6c453;--sg-card-glow:rgba(167,139,250,.34)}
  #teacher-section article.sg-teacher-premium-card.sg-theme-crimson{--sg-card-a:#4a1020;--sg-card-b:#a32942;--sg-card-c:#e05268;--sg-card-accent:#ffd166;--sg-card-glow:rgba(251,113,133,.31)}
  #teacher-section article.sg-teacher-premium-card.sg-theme-teal{--sg-card-a:#063542;--sg-card-b:#087a8a;--sg-card-c:#16b8b0;--sg-card-accent:#f5c84c;--sg-card-glow:rgba(45,212,191,.32)}
  #teacher-section article.sg-teacher-premium-card.sg-theme-indigo{--sg-card-a:#172554;--sg-card-b:#3730a3;--sg-card-c:#6366f1;--sg-card-accent:#f5c84c;--sg-card-glow:rgba(129,140,248,.34)}
  #teacher-section article.sg-teacher-premium-card:hover{transform:translateY(-5px)!important;border-color:color-mix(in srgb,var(--sg-card-accent) 68%,transparent)!important;box-shadow:0 34px 72px rgba(1,9,25,.40),0 0 30px color-mix(in srgb,var(--sg-card-accent) 13%,transparent)!important}
  #teacher-section article.sg-teacher-premium-card>div:first-child{position:relative;isolation:isolate;overflow:hidden;min-height:132px!important;padding:22px!important;background:linear-gradient(118deg,var(--sg-card-a) 0%,var(--sg-card-b) 48%,var(--sg-card-c) 100%)!important;border-bottom:3px solid var(--sg-card-accent)!important;box-shadow:inset 0 -1px 0 rgba(255,255,255,.14),0 10px 28px rgba(5,42,100,.20)!important}
  #teacher-section article.sg-teacher-premium-card>div:first-child::before{content:"";position:absolute;z-index:-1;inset:0;background:linear-gradient(100deg,rgba(255,255,255,.06),transparent 45%),radial-gradient(circle at 82% 18%,var(--sg-card-glow),transparent 30%);pointer-events:none}
  #teacher-section article.sg-teacher-premium-card>div:first-child::after{content:"";position:absolute;z-index:-1;right:-42px;top:-96px;width:235px;height:235px;border-radius:50%;border:1px solid rgba(255,255,255,.25);box-shadow:0 0 0 22px rgba(255,255,255,.025),0 0 0 48px rgba(255,255,255,.018);background:radial-gradient(circle,var(--sg-card-glow),transparent 66%);pointer-events:none}
  #teacher-section article.sg-teacher-premium-card>div:first-child h4{color:#fff!important;font-size:1.22rem!important;font-weight:900!important;line-height:1.25;text-shadow:0 2px 10px rgba(0,12,38,.36)}
  #teacher-section article.sg-teacher-premium-card>div:first-child p{color:rgba(248,250,252,.90)!important;font-weight:600}
  #teacher-section article.sg-teacher-premium-card>div:first-child .h-14{background:rgba(255,255,255,.16)!important;color:#fff3b0!important;border:1px solid color-mix(in srgb,var(--sg-card-accent) 58%,transparent)!important;backdrop-filter:blur(12px);box-shadow:0 10px 25px rgba(0,15,45,.25),inset 0 1px 0 rgba(255,255,255,.24)!important;overflow:hidden!important;display:grid!important;place-items:center!important;flex:0 0 56px!important}.sg-teacher-premium-card>div:first-child .h-14 i{font-size:20px!important;line-height:1!important;margin:0!important;transform:none!important}
  #teacher-section article.sg-teacher-premium-card:hover>div:first-child{filter:saturate(1.12) brightness(1.04)}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2){padding:18px 20px 20px!important;background:#fff4bf!important;background-image:linear-gradient(145deg,#fff9dc,#ffefad)!important;color:#172033!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2)>div:first-child{padding:12px 13px;border-radius:14px;border:1px solid rgba(180,193,213,.46);background:rgba(255,255,255,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.86)}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2) p,#teacher-section article.sg-teacher-premium-card>div:nth-child(2) code{color:#172033!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2) .text-slate-500{color:#64748b!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2)>.mt-5.grid button{border:1px solid rgba(180,193,213,.42)!important;border-radius:14px!important;box-shadow:0 7px 18px rgba(7,26,61,.05);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2)>.mt-5.grid button:first-child{background:linear-gradient(135deg,rgba(219,234,254,.88),rgba(239,246,255,.96))!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2)>.mt-5.grid button:last-child{background:linear-gradient(135deg,rgba(254,243,199,.82),rgba(255,251,235,.96))!important;border-color:rgba(212,167,44,.30)!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2)>.mt-5.grid button:hover{transform:translateY(-2px);box-shadow:0 11px 24px rgba(7,26,61,.09)}
  #teacher-section article.sg-teacher-premium-card button[onclick*="selectClass"]{background:linear-gradient(135deg,var(--sg-card-a),var(--sg-card-b) 70%,color-mix(in srgb,var(--sg-card-accent) 68%,var(--sg-card-b)))!important;color:#fff!important;border:1px solid color-mix(in srgb,var(--sg-card-accent) 34%,transparent)!important;box-shadow:0 11px 24px rgba(7,26,61,.18)!important}
  #teacher-section article.sg-teacher-premium-card button[onclick*="selectClass"]:hover{filter:brightness(1.08)}
  #teacher-section article.sg-teacher-premium-card button[onclick*="editClass"]{background:rgba(255,255,255,.82)!important;border:1px solid rgba(180,193,213,.58)!important;color:#0b2457!important}
  #teacher-section article.sg-teacher-premium-card i{vertical-align:middle}
  #teacher-section article.sg-teacher-premium-card button i{display:inline-block!important;width:1.1em!important;text-align:center!important;margin-right:.35rem!important;line-height:1!important}
  #teacher-section #teacher-class-select{background:#fffdf4!important;color:#0b2457!important;border-color:#d4a72c!important;font-weight:800!important}
  #teacher-section #teacher-class-select option{background:#fff!important;color:#0f172a!important}
  #teacher-section label[for="teacher-class-select"]{color:#e8eefc!important;font-weight:800!important}
  #teacher-section article.sg-teacher-premium-card>div:not(:first-child){background-color:#fff4bf!important}
  #teacher-section .sg-teacher-class-gallery .sg-ref-heading::before{display:none!important;content:none!important}
  #teacher-section .sg-teacher-class-gallery .sg-ref-heading{gap:0!important}
  @media(max-width:640px){#teacher-section .sg-teacher-class-gallery{padding:15px 16px;border-radius:17px}#teacher-section article.sg-teacher-premium-card>div:first-child{padding:18px 16px!important;min-height:120px!important}#teacher-section article.sg-teacher-premium-card>div:nth-child(2){padding:15px!important}}
  `;
  document.head.appendChild(css);

  const themes=['sg-theme-blue','sg-theme-emerald','sg-theme-violet','sg-theme-crimson','sg-theme-teal','sg-theme-indigo'];
  const themeFor=c=>{
    const seed=String(c?.id||c?.class_code||c?.classCode||c?.name||c?.subject_name||'class');
    let hash=0;for(let i=0;i<seed.length;i++)hash=((hash<<5)-hash+seed.charCodeAt(i))|0;
    return themes[Math.abs(hash)%themes.length];
  };
  const original=Teacher.renderClassCard?.bind(Teacher);
  if(original){
    Teacher.renderClassCard=function(c){
      const html=original(c);
      return html.replace('<article class="',`<article class="sg-teacher-premium-card ${themeFor(c)} `);
    };
  }

  const originalRender=Teacher.render?.bind(Teacher);
  if(originalRender){
    Teacher.render=async function(){
      await originalRender();
      const section=document.getElementById('teacher-section');
      if(!section)return;
      const dashboardTitle=[...section.querySelectorAll('h2')].find(x=>(x.textContent||'').trim()==='Teacher Dashboard');
      const dashboardIcon=dashboardTitle?.parentElement?.previousElementSibling;
      if(dashboardIcon){dashboardIcon.classList.add('sg-teacher-dashboard-icon');const row=dashboardIcon.parentElement;if(row){row.style.alignItems='center';row.style.gap='12px';}}
      const myClasses=[...section.querySelectorAll('h3')].find(x=>(x.textContent||'').trim()==='My Classes');
      myClasses?.classList.remove('sg-ref-heading');
      section.querySelectorAll('button[onclick="Teacher.showCreateClass()"]').forEach(btn=>{if((btn.textContent||'').includes('Create New Class'))btn.remove();});
      const cards=[...section.querySelectorAll('article.sg-teacher-premium-card')];
      if(cards.length){
        const grid=cards[0].parentElement;
        const previous=grid?.previousElementSibling;
        if(previous&&!previous.classList.contains('sg-teacher-class-gallery'))previous.classList.add('sg-teacher-class-gallery');
      }
    };
  }
})();