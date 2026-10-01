(() => {
  'use strict';

  const STYLE_ID='ndc-motion-v4-style';

  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      :root{
        --ndc-motion-fast:150ms;
        --ndc-motion-base:220ms;
        --ndc-motion-slow:320ms;
        --ndc-ease:cubic-bezier(.22,.8,.24,1);
      }

      @keyframes ndcFadeUp{
        from{opacity:0;transform:translateY(10px)}
        to{opacity:1;transform:translateY(0)}
      }
      @keyframes ndcSoftIn{
        from{opacity:0;transform:scale(.985)}
        to{opacity:1;transform:scale(1)}
      }
      @keyframes ndcSelectedPulse{
        0%{box-shadow:0 18px 34px rgba(15,23,42,.12),0 0 0 0 rgba(37,99,235,.22)}
        55%{box-shadow:0 20px 38px rgba(15,23,42,.15),0 0 0 7px rgba(37,99,235,0)}
        100%{box-shadow:0 18px 34px rgba(15,23,42,.12),0 0 0 0 rgba(37,99,235,0)}
      }
      @keyframes ndcSaveFlash{
        0%{transform:scale(.96)}
        55%{transform:scale(1.05)}
        100%{transform:scale(1)}
      }

      .ndc-view-enter{animation:ndcFadeUp var(--ndc-motion-base) var(--ndc-ease) both}
      .ndc-soft-enter{animation:ndcSoftIn var(--ndc-motion-base) var(--ndc-ease) both}

      /* Sequential My Classes entrance */
      .exact-strip-card.ndc-card-enter{
        opacity:0;
        animation:ndcFadeUp var(--ndc-motion-slow) var(--ndc-ease) forwards;
        animation-delay:var(--ndc-stagger,0ms)
      }

      /* Desktop class-card interactivity */
      @media (hover:hover) and (pointer:fine){
        .exact-strip-card{
          will-change:transform,box-shadow;
          transition:
            transform var(--ndc-motion-base) var(--ndc-ease),
            box-shadow var(--ndc-motion-base) var(--ndc-ease),
            border-color var(--ndc-motion-base) ease,
            filter var(--ndc-motion-base) ease!important
        }
        .exact-strip-card:hover{
          transform:translateY(-6px) scale(1.022)!important;
          box-shadow:0 20px 38px rgba(15,23,42,.15),0 0 0 1px color-mix(in srgb,var(--card-accent) 34%,transparent)!important
        }
        .exact-strip-edit,.exact-strip-create,.exact-primary-nav button,.sg-ref-tabs .tab-btn{
          transition:
            transform var(--ndc-motion-fast) ease,
            background-color var(--ndc-motion-fast) ease,
            color var(--ndc-motion-fast) ease,
            box-shadow var(--ndc-motion-fast) ease!important
        }
        .exact-strip-edit:hover,.exact-strip-create:hover{transform:translateY(-2px)}
      }

      .exact-strip-card.selected.ndc-selected-pulse{
        animation:ndcSelectedPulse 480ms var(--ndc-ease)
      }

      /* Teacher content transitions */
      .exact-view-panel.ndc-view-enter,
      #teacher-tab-content.ndc-view-enter,
      .exact-class-strip.ndc-view-enter{
        transform-origin:top center
      }

      /* Buttons feel responsive */
      button,.tab-btn,.exact-strip-open,.exact-strip-edit,.exact-strip-create{
        -webkit-tap-highlight-color:transparent
      }
      button:active,.tab-btn:active,.exact-strip-open:active,.exact-strip-edit:active,.exact-strip-create:active{
        transform:scale(.975)
      }

      /* Save -> Saved state feedback */
      [id^="score-save-"].ndc-saved-flash{
        animation:ndcSaveFlash 260ms var(--ndc-ease)
      }

      /* Notification cards appear sequentially */
      .exact-notification-card.ndc-card-enter{
        opacity:0;
        animation:ndcFadeUp var(--ndc-motion-slow) var(--ndc-ease) forwards;
        animation-delay:var(--ndc-stagger,0ms)
      }

      /* Modal transitions */
      .fixed.inset-0.ndc-modal-enter{
        animation:ndcSoftIn var(--ndc-motion-base) var(--ndc-ease) both
      }

      /* Smooth mobile bottom-nav selection */
      #ndc-teacher-mobile-nav button{
        transition:
          background-color var(--ndc-motion-fast) ease,
          color var(--ndc-motion-fast) ease,
          transform var(--ndc-motion-fast) ease!important
      }
      #ndc-teacher-mobile-nav button:active{transform:scale(.96)}

      @media (prefers-reduced-motion: reduce){
        *,*::before,*::after{
          animation-duration:.01ms!important;
          animation-iteration-count:1!important;
          transition-duration:.01ms!important;
          scroll-behavior:auto!important
        }
      }
    `;
    document.head.appendChild(style);
  }

  const seen=new WeakMap();

  function pulseSelected(){
    const selected=document.querySelector('.exact-strip-card.selected');
    if(!selected) return;
    const sig=selected.dataset.classId||'selected';
    if(seen.get(selected)===sig) return;
    seen.set(selected,sig);
    selected.classList.remove('ndc-selected-pulse');
    void selected.offsetWidth;
    selected.classList.add('ndc-selected-pulse');
    setTimeout(()=>selected.classList.remove('ndc-selected-pulse'),520);
  }

  function stagger(selector,step=70){
    document.querySelectorAll(selector).forEach((el,i)=>{
      if(el.dataset.ndcAnimated==='1') return;
      el.dataset.ndcAnimated='1';
      el.style.setProperty('--ndc-stagger',Math.min(i,8)*step+'ms');
      el.classList.add('ndc-card-enter');
      el.addEventListener('animationend',()=>el.classList.remove('ndc-card-enter'),{once:true});
    });
  }

  function animateView(){
    const section=document.getElementById('teacher-section');
    if(!section || section.classList.contains('hidden')) return;

    const view=section.dataset.exactView||'overview';
    if(section.dataset.ndcMotionView!==view){
      section.dataset.ndcMotionView=view;
      const target=view==='classes'
        ? section.querySelector('.exact-class-strip')
        : section.querySelector('.exact-view-panel');
      if(target){
        target.classList.remove('ndc-view-enter');
        void target.offsetWidth;
        target.classList.add('ndc-view-enter');
        target.addEventListener('animationend',()=>target.classList.remove('ndc-view-enter'),{once:true});
      }
    }

    stagger('.exact-strip-card',65);
    stagger('.exact-notification-card',55);
    pulseSelected();
  }

  function animateTeacherTab(){
    const box=document.getElementById('teacher-tab-content');
    if(!box || box.dataset.ndcBound==='1') return;
    box.dataset.ndcBound='1';

    new MutationObserver(()=>{
      box.classList.remove('ndc-view-enter');
      void box.offsetWidth;
      box.classList.add('ndc-view-enter');
      setTimeout(()=>box.classList.remove('ndc-view-enter'),260);
    }).observe(box,{childList:true});
  }

  function watchSaveButtons(){
    document.querySelectorAll('[id^="score-save-"]').forEach(btn=>{
      if(btn.dataset.ndcSaveBound==='1') return;
      btn.dataset.ndcSaveBound='1';
      new MutationObserver(()=>{
        if((btn.textContent||'').trim()==='Saved'){
          btn.classList.remove('ndc-saved-flash');
          void btn.offsetWidth;
          btn.classList.add('ndc-saved-flash');
          setTimeout(()=>btn.classList.remove('ndc-saved-flash'),300);
        }
      }).observe(btn,{childList:true,subtree:true,characterData:true});
    });
  }

  function animateNewModals(){
    document.querySelectorAll('.fixed.inset-0').forEach(el=>{
      if(el.dataset.ndcModalAnimated==='1') return;
      el.dataset.ndcModalAnimated='1';
      el.classList.add('ndc-modal-enter');
      setTimeout(()=>el.classList.remove('ndc-modal-enter'),260);
    });
  }

  let queued=false;
  function refresh(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      animateView();
      animateTeacherTab();
      watchSaveButtons();
      animateNewModals();
    });
  }

  window.addEventListener('load',refresh);
  new MutationObserver(refresh).observe(document.body,{
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['class','data-exact-view']
  });
  refresh();
})();