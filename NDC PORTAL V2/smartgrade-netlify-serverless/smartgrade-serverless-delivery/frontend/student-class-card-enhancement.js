// Student Dashboard visual enhancement only.
// Preserves existing Student APIs, grading visibility rules, and actions.
(() => {
  if (typeof Student === 'undefined') return;

  const css=document.createElement('style');
  css.id='sg-student-class-card-enhancement';
  css.textContent=`
  #student-section .sg-student-classes-heading{position:relative;overflow:hidden;margin:0 0 16px!important;padding:18px 20px!important;border:1px solid rgba(99,102,241,.24);border-radius:20px;background:linear-gradient(125deg,rgba(11,36,87,.96),rgba(37,99,235,.91) 58%,rgba(124,58,237,.84));color:#fff!important;box-shadow:0 18px 42px rgba(37,99,235,.18),inset 0 1px 0 rgba(255,255,255,.16);backdrop-filter:blur(18px)}
  #student-section .sg-student-classes-heading::after{content:"";position:absolute;width:180px;height:180px;right:-45px;top:-95px;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:radial-gradient(circle,rgba(255,255,255,.14),transparent 68%);pointer-events:none}
  #student-section .sg-student-classes-heading h3{margin:0!important;color:#fff!important;font-size:1.25rem!important;font-weight:900!important;letter-spacing:-.02em}
  #student-section .sg-student-classes-heading h3 i{display:inline-grid;place-items:center;width:34px;height:34px;margin-right:9px;border-radius:10px;color:#fff!important;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.22);box-shadow:0 7px 18px rgba(7,26,61,.18)}
  #student-section .sg-student-class-card{padding:0!important;border:1px solid rgba(96,165,250,.44)!important;border-radius:24px!important;background:linear-gradient(150deg,rgba(255,255,255,.95),rgba(239,246,255,.86))!important;box-shadow:0 24px 58px rgba(37,99,235,.17),0 8px 22px rgba(15,23,42,.07)!important;overflow:hidden!important}
  #student-section .sg-student-class-card::before{display:none!important}
  #student-section .sg-student-card-head{position:relative;overflow:hidden;padding:20px 22px!important;background:linear-gradient(120deg,#0b2f68 0%,#2563eb 54%,#6d3ee8 100%);color:#fff;border-bottom:1px solid rgba(255,255,255,.18)}
  #student-section .sg-student-card-head::after{content:"";position:absolute;right:-45px;top:-90px;width:230px;height:210px;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:radial-gradient(circle,rgba(255,255,255,.15),transparent 66%);pointer-events:none}
  #student-section .sg-student-card-head h4{position:relative;z-index:1;color:#fff!important;font-size:1.18rem!important;line-height:1.25;font-weight:900!important}
  #student-section .sg-student-card-head p{position:relative;z-index:1;color:rgba(255,255,255,.78)!important;margin-top:5px;font-weight:600}
  #student-section .sg-student-card-head>span{position:relative;z-index:1;background:rgba(255,255,255,.15)!important;color:#fff!important;border:1px solid rgba(255,255,255,.22);border-radius:999px!important;padding:7px 11px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}
  #student-section .sg-student-card-body{padding:17px 20px 20px}
  #student-section .sg-student-card-components{display:grid;gap:8px;margin-top:0!important}
  #student-section .sg-student-card-components>div{border:1px solid rgba(203,213,225,.56)!important;border-bottom:1px solid rgba(203,213,225,.56)!important;border-radius:13px;padding:10px 12px!important;background:rgba(255,255,255,.64);box-shadow:inset 0 1px 0 rgba(255,255,255,.78);font-size:.78rem!important;font-weight:700;color:#334155;transition:transform .16s ease,border-color .16s ease,background .16s ease}
  #student-section .sg-student-card-components>div:hover{transform:translateX(2px);border-color:rgba(96,165,250,.55)!important;background:rgba(239,246,255,.86)}
  #student-section .sg-student-card-components>div:nth-child(1){background:linear-gradient(90deg,rgba(209,250,229,.66),rgba(255,255,255,.70))}
  #student-section .sg-student-card-components>div:nth-child(2){background:linear-gradient(90deg,rgba(219,234,254,.72),rgba(255,255,255,.70))}
  #student-section .sg-student-card-components>div:nth-child(3){background:linear-gradient(90deg,rgba(254,243,199,.68),rgba(255,255,255,.70))}
  #student-section .sg-student-card-components>div:nth-child(4){background:linear-gradient(90deg,rgba(237,233,254,.74),rgba(255,255,255,.70))}
  #student-section .sg-student-card-grade{margin-top:12px;padding-top:2px}
  #student-section .sg-student-card-grade>div{border-radius:13px;padding:10px 12px;background:rgba(255,247,237,.78);border:1px solid rgba(253,186,116,.42)}
  #student-section .sg-grade-equivalent-box{margin:12px 0 0!important;border-radius:14px!important;background:linear-gradient(135deg,rgba(219,234,254,.84),rgba(237,233,254,.72))!important;border:1px solid rgba(129,140,248,.35)!important}
  @media(max-width:640px){#student-section .sg-student-classes-heading{padding:15px 16px!important;border-radius:17px}#student-section .sg-student-card-head{padding:17px 16px!important}#student-section .sg-student-card-body{padding:14px 15px 17px}#student-section .sg-student-card-head>div{max-width:75%}}
  `;
  document.head.appendChild(css);

  const originalClassCard=Student.classCard?.bind(Student);
  if(originalClassCard){
    Student.classCard=function(c,grade){
      let html=originalClassCard(c,grade);
      html=html.replace(/<div class="glass-card sg-student-class-card rounded-2xl p-5">/, '<div class="glass-card sg-student-class-card rounded-2xl p-5">');
      html=html.replace(/(<div class="glass-card sg-student-class-card[^>]*>\s*)(<div class="flex justify-between items-start">)/, '$1<div class="sg-student-card-head">$2');
      html=html.replace(/(<div class="mt-3">\s*[^]*?<\/div>\s*)(?=<div|$)/, '$1');
      // Close the injected header immediately before the component list.
      html=html.replace(/(\s*<div class="mt-3">)/, '</div><div class="sg-student-card-body"><div class="sg-student-card-components">');
      // The original component wrapper closes once after all component rows.
      // Rename its closing context by inserting the body grade wrapper before gradeBlock.
      const gradeMarkers=['mt-2 text-2xl font-black text-emerald-700','mt-2 text-sm text-amber-700 font-semibold','mt-2 text-sm text-red-600 font-semibold'];
      for(const marker of gradeMarkers){
        const needle=`<div\n          class="${marker}"`;
        if(html.includes(needle)){html=html.replace(needle,`</div><div class="sg-student-card-grade"><div\n          class="${marker}"`);break;}
      }
      // Close body/grade wrappers before the card's final closing tag.
      html=html.replace(/<\/div>\s*$/, '</div></div></div>');
      return html;
    };
  }

  const originalRender=Student.render?.bind(Student);
  if(originalRender){
    Student.render=async function(){
      await originalRender();
      const section=document.getElementById('student-section');
      if(!section)return;
      const heading=[...section.querySelectorAll('h3')].find(x=>(x.textContent||'').toLowerCase().includes('my classes'));
      if(heading){
        const host=heading.parentElement;
        if(host&&!host.classList.contains('sg-student-classes-heading'))host.classList.add('sg-student-classes-heading');
      }
    };
  }
})();