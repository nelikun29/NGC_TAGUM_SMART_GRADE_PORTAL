// Email-based password recovery with admin fallback queue.
(() => {
  function modal(html){
    const old=document.getElementById('sg-password-reset-modal');
    if(old) old.remove();
    const m=document.createElement('div');
    m.id='sg-password-reset-modal';
    m.className='fixed inset-0 z-[150] flex items-center justify-center p-4';
    m.innerHTML='<div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" data-close-reset></div><div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-5">'+html+'</div>';
    document.body.appendChild(m);
    m.querySelectorAll('[data-close-reset]').forEach(x=>x.onclick=()=>m.remove());
    return m;
  }

  function installForgot(){
    const input=document.getElementById('login-password');
    if(!input||document.getElementById('sg-forgot-password')) return;
    const host=input.closest('.relative')?.parentElement||input.parentElement;
    const row=document.createElement('div');
    row.className='text-right mt-2';
    row.innerHTML='<button id="sg-forgot-password" type="button" class="text-xs font-bold text-blue-600 hover:text-blue-800">Forgot Password?</button>';
    host.appendChild(row);

    row.querySelector('button').onclick=()=>{
      const m=modal(
        '<h3 class="text-lg font-black text-slate-800">Forgot Password</h3>'+
        '<p class="text-sm text-slate-500 mt-1">Enter the active email address registered to your account. If it matches an active account, we will send a secure reset link.</p>'+
        '<form id="sg-reset-request" class="mt-4 space-y-3">'+
          '<input id="sg-reset-email" required type="email" autocomplete="email" placeholder="Registered active email" class="w-full px-3 py-3 rounded-xl border border-slate-300 text-sm">'+
          '<button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">Send Reset Link</button>'+
          '<button type="button" data-close-reset class="w-full text-sm font-bold text-slate-500 py-2">Cancel</button>'+
        '</form>'
      );

      m.querySelector('#sg-reset-request').onsubmit=async e=>{
        e.preventDefault();
        try{
          const r=await api('POST','/auth/forgot-password',{email:m.querySelector('#sg-reset-email').value});
          Toast.show('Check Your Email',r.message,'success');
          m.remove();
        }catch{}
      };
    };
  }

  function openResetFromLink(){
    const params=new URLSearchParams(window.location.search);
    const token=params.get('resetToken');
    if(!token) return;

    const m=modal(
      '<h3 class="text-lg font-black text-slate-800">Set New Password</h3>'+
      '<p class="text-sm text-slate-500 mt-1">Enter your new password twice. This reset link expires after 30 minutes and can only be used once.</p>'+
      '<form id="sg-email-reset-form" class="mt-4 space-y-3">'+
        '<input id="sg-new-password" required type="password" minlength="8" autocomplete="new-password" placeholder="New password (minimum 8 characters)" class="w-full px-3 py-3 rounded-xl border border-slate-300 text-sm">'+
        '<input id="sg-confirm-password" required type="password" minlength="8" autocomplete="new-password" placeholder="Re-enter new password" class="w-full px-3 py-3 rounded-xl border border-slate-300 text-sm">'+
        '<button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">Update Password</button>'+
      '</form>'
    );

    const backdrop=m.querySelector('[data-close-reset]');
    if(backdrop) backdrop.removeAttribute('data-close-reset');

    m.querySelector('#sg-email-reset-form').onsubmit=async e=>{
      e.preventDefault();
      const password=m.querySelector('#sg-new-password').value;
      const confirmPassword=m.querySelector('#sg-confirm-password').value;

      if(password.length<8){
        Toast.show('Invalid Password','Password must be at least 8 characters.','error');
        return;
      }
      if(password!==confirmPassword){
        Toast.show('Passwords Do Not Match','Please enter the same password twice.','error');
        return;
      }

      try{
        const r=await api('POST','/auth/reset-password',{token,newPassword:password,confirmPassword});
        Toast.show('Password Updated',r.message,'success');
        history.replaceState({},document.title,window.location.pathname+window.location.hash);
        m.remove();
        if(typeof Views!=='undefined'&&typeof Views.authTab==='function') Views.authTab('login');
      }catch{}
    };
  }

  // Existing administrator fallback queue remains available.
  async function openQueue(){
    try{
      const rows=await api('GET','/auth/password-reset-requests');
      const body=rows.length?rows.map(r=>
        '<div class="border-b py-3">'+
          '<div class="font-bold text-sm">'+esc(r.first_name||'')+' '+esc(r.last_name||'')+'</div>'+
          '<div class="text-xs text-slate-500">'+esc(r.email)+' · '+esc(r.role)+'</div>'+
          '<div class="mt-2 flex gap-2">'+
            '<button data-reset="'+r.id+'" class="text-xs font-bold bg-blue-600 text-white px-3 py-2 rounded-lg">Set New Password</button>'+
            '<button data-dismiss="'+r.id+'" class="text-xs font-bold bg-slate-100 px-3 py-2 rounded-lg">Dismiss</button>'+
          '</div>'+
        '</div>'
      ).join(''):'<p class="text-sm text-slate-500 py-6 text-center">No pending password reset requests.</p>';

      const m=modal(
        '<div class="flex justify-between gap-3"><div><h3 class="text-lg font-black">Password Reset Requests</h3><p class="text-xs text-slate-500">Email reset is the primary recovery method. Administrator reset remains available as a fallback.</p></div><button data-close-reset class="text-slate-500">✕</button></div>'+
        '<div class="mt-4 max-h-[60vh] overflow-y-auto">'+body+'</div>'
      );

      m.querySelectorAll('[data-reset]').forEach(b=>b.onclick=async()=>{
        const p=prompt('Enter a temporary/new password (minimum 8 characters):');
        if(p===null)return;
        if(p.length<8){Toast.show('Invalid Password','Password must be at least 8 characters.','error');return;}
        if(!confirm('Reset this account password and clear its login lock?'))return;
        try{
          await api('POST','/auth/password-reset-requests/'+b.dataset.reset+'/complete',{newPassword:p});
          Toast.show('Password Reset','Password updated successfully.','success');
          m.remove();
          openQueue();
        }catch{}
      });

      m.querySelectorAll('[data-dismiss]').forEach(b=>b.onclick=async()=>{
        if(!confirm('Dismiss this password reset request?'))return;
        try{
          await api('POST','/auth/password-reset-requests/'+b.dataset.dismiss+'/dismiss');
          m.remove();
          openQueue();
        }catch{}
      });
    }catch{}
  }

  window.SmartGradePasswordReset={openQueue};
  installForgot();
  openResetFromLink();
  new MutationObserver(()=>installForgot()).observe(document.body,{childList:true,subtree:true});
})();
