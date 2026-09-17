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
  #teacher-section .sg-teacher-class-gallery p{color:#c7d4e8!important}
  #teacher-section article.sg-teacher-premium-card{padding:0!important;overflow:hidden!important;border-radius:24px!important;border:1px solid rgba(246,214,111,.30)!important;background:linear-gradient(150deg,rgba(11,36,87,.90),rgba(7,26,61,.82))!important;box-shadow:0 25px 58px rgba(1,9,25,.38),0 8px 22px rgba(212,167,44,.07),inset 0 1px 0 rgba(255,255,255,.07)!important;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease!important}
  #teacher-section article.sg-teacher-premium-card:hover{transform:translateY(-5px)!important;border-color:rgba(246,214,111,.52)!important;box-shadow:0 34px 72px rgba(1,9,25,.46),0 0 30px rgba(212,167,44,.10)!important}
  #teacher-section article.sg-teacher-premium-card>div:first-child{position:relative;overflow:hidden;min-height:126px!important;padding:22px!important;background:linear-gradient(120deg,#071a3d 0%,#0b3a78 58%,#9b741b 135%)!important;border-bottom:1px solid rgba(246,214,111,.25)!important}
  #teacher-section article.sg-teacher-premium-card>div:first-child::after{content:"";position:absolute;right:-38px;top:-92px;width:220px;height:220px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:radial-gradient(circle,rgba(246,214,111,.13),transparent 67%);pointer-events:none}
  #teacher-section article.sg-teacher-premium-card>div:first-child h4{color:#fff!important;font-size:1.18rem!important;font-weight:900!important;line-height:1.25}
  #teacher-section article.sg-teacher-premium-card>div:first-child p{color:rgba(255,255,255,.76)!important}
  #teacher-section article.sg-teacher-premium-card>div:first-child .h-14{background:rgba(255,255,255,.11)!important;color:#f6d66f!important;border:1px solid rgba(246,214,111,.26);backdrop-filter:blur(10px);box-shadow:0 9px 22px rgba(1,9,25,.20)!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2){padding:18px 20px 20px!important;background:linear-gradient(145deg,rgba(250,252,255,.96),rgba(240,245,252,.92))!important;color:#172033}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2)>div:first-child{padding:12px 13px;border-radius:14px;border:1px solid rgba(180,193,213,.46);background:rgba(255,255,255,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.86)}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2) p,#teacher-section article.sg-teacher-premium-card>div:nth-child(2) code{color:#172033!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2) .text-slate-500{color:#64748b!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2)>.mt-5.grid button{border:1px solid rgba(180,193,213,.42)!important;border-radius:14px!important;box-shadow:0 7px 18px rgba(7,26,61,.05);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2)>.mt-5.grid button:first-child{background:linear-gradient(135deg,rgba(219,234,254,.88),rgba(239,246,255,.96))!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2)>.mt-5.grid button:last-child{background:linear-gradient(135deg,rgba(254,243,199,.82),rgba(255,251,235,.96))!important;border-color:rgba(212,167,44,.30)!important}
  #teacher-section article.sg-teacher-premium-card>div:nth-child(2)>.mt-5.grid button:hover{transform:translateY(-2px);box-shadow:0 11px 24px rgba(7,26,61,.09)}
  #teacher-section article.sg-teacher-premium-card button[onclick*="selectClass"]{background:linear-gradient(135deg,#0b2f68,#174d96 68%,#b88618)!important;color:#fff!important;border:1px solid rgba(246,214,111,.28)!important;box-shadow:0 11px 24px rgba(7,26,61,.18)!important}
  #teacher-section article.sg-teacher-premium-card button[onclick*="selectClass"]:hover{filter:brightness(1.08)}
  #teacher-section article.sg-teacher-premium-card button[onclick*="editClass"]{background:rgba(255,255,255,.82)!important;border:1px solid rgba(180,193,213,.58)!important;color:#0b2457!important}
  @media(max-width:640px){#teacher-section .sg-teacher-class-gallery{padding:15px 16px;border-radius:17px}#teacher-section article.sg-teacher-premium-card>div:first-child{padding:18px 16px!important}#teacher-section article.sg-teacher-premium-card>div:nth-child(2){padding:15px!important}}
  `;
  document.head.appendChild(css);

  const original=Teacher.renderClassCard?.bind(Teacher);
  if(original){
    Teacher.renderClassCard=function(c){
      const html=original(c);
      return html.replace('<article class="','<article class="sg-teacher-premium-card ');
    };
  }

  const originalRender=Teacher.render?.bind(Teacher);
  if(originalRender){
    Teacher.render=async function(){
      await originalRender();
      const section=document.getElementById('teacher-section');
      if(!section)return;
      // Style the heading immediately above the teacher class-card grid when present.
      const cards=[...section.querySelectorAll('article.sg-teacher-premium-card')];
      if(cards.length){
        const grid=cards[0].parentElement;
        const previous=grid?.previousElementSibling;
        if(previous&&!previous.classList.contains('sg-teacher-class-gallery'))previous.classList.add('sg-teacher-class-gallery');
      }
    };
  }
})();