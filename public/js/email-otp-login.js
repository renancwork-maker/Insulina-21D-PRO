/* Login por compra aprovada Wiapy: sem OTP, sem senha, e-mail ou celular.
 * AVISO: possuir o identificador da compra passa a ser suficiente para acessar
 * a conta. É uma opção menos segura do que verificar a identidade do comprador.
 */
(()=>{'use strict';
  if (/^\/(admin|ativar|recuperar-senha)(\/|$)/.test(location.pathname)) return;
  const css=`
    #cs-direct-cover{position:fixed;inset:0;z-index:2147483600;overflow-y:auto;background:linear-gradient(155deg,#153e30,#225941);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Poppins,system-ui,sans-serif;color:#153e30}
    #cs-direct-cover[hidden]{display:none!important}
    #cs-direct-card{max-width:440px;width:100%;background:#fffdf5;border-radius:24px;padding:28px 24px;box-shadow:0 20px 60px #081b1666}
    #cs-direct-card h1{font-size:25px;font-weight:800;line-height:1.2;margin:0 0 10px}
    #cs-direct-card p{font-size:14px;line-height:1.55;color:#50685c}
    #cs-direct-card label{font-size:14px;font-weight:700;display:block;margin-bottom:8px}
    #cs-direct-card input{box-sizing:border-box;width:100%;border:1px solid #b7c9bf;border-radius:12px;padding:16px;font-size:16px;background:#fff;color:#153e30}
    #cs-direct-card input:focus{outline:2px solid #8fba9e;outline-offset:2px}
    #cs-direct-card button{width:100%;background:#196747;border:0;border-radius:12px;color:#fff;font-weight:750;font-size:16px;padding:15px;margin-top:14px;cursor:pointer}
    #cs-direct-card button:disabled{opacity:.55;cursor:wait}
    #cs-direct-msg{margin-top:13px;font-size:14px;line-height:1.5;min-height:1.3em}
    #cs-direct-msg.error{color:#a92323}
    #cs-direct-card .cs-eyebrow{letter-spacing:.11em;color:#307753;font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:12px}
    #cs-direct-card .cs-help{font-size:12px;text-align:center;margin-top:18px}
    #cs-direct-card .cs-help a{color:#196747;font-weight:700}
  `;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  const cover=document.createElement('div');cover.id='cs-direct-cover';cover.setAttribute('role','main');
  cover.innerHTML=`<section id="cs-direct-card" aria-label="Acesso de compradores">
    <div class="cs-eyebrow">Segredo da Insulina • 21 dias</div>
    <h1>Entre no seu aplicativo</h1>
    <p>Digite o e-mail ou celular informado na compra. Não é necessário receber código ou criar senha.</p>
    <form id="cs-direct-form" novalidate>
      <label for="cs-direct-id">E-mail ou celular da compra</label>
      <input id="cs-direct-id" type="text" autocomplete="username" required placeholder="E-mail ou celular com DDD" maxlength="254"/>
      <button id="cs-direct-submit" type="submit">Acessar meu aplicativo</button>
    </form>
    <p id="cs-direct-msg" role="status" aria-live="polite"></p>
    <p class="cs-help">Não localizou sua compra? <a href="mailto:suporte@digitalco.site?subject=Ajuda%20com%20meu%20acesso">Fale com o suporte</a>.</p>
  </section>`;
  document.body.appendChild(cover);
  const form=document.getElementById('cs-direct-form');
  const field=document.getElementById('cs-direct-id');
  const submit=document.getElementById('cs-direct-submit');
  const msg=document.getElementById('cs-direct-msg');
  let busy=false;
  function showMessage(text,error=false){msg.textContent=text;msg.className=error?'error':'';}
  form.addEventListener('submit',async e=>{
    e.preventDefault(); if(busy)return;
    const identifier=field.value.trim();
    if(!identifier){showMessage('Digite o e-mail ou celular utilizado na compra.',true);return;}
    const sb=window.__clubeSupabase;
    if(!sb){showMessage('Estamos carregando o acesso. Tente novamente.',true);return;}
    busy=true;submit.disabled=true;submit.textContent='Conferindo sua compra…';showMessage('');
    try{
      const res=await fetch('/api/purchase-direct-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier})});
      const body=await res.json().catch(()=>({}));
      if(!res.ok || !body.token_hash){
        if(body.error==='phone_lookup_unavailable')showMessage('A consulta por celular ainda não está habilitada. Utilize o e-mail da compra.',true);
        else if(body.error==='purchase_not_found')showMessage('Não encontramos uma compra aprovada para esse e-mail ou celular. Confira os dados ou fale com o suporte.',true);
        else showMessage('Não foi possível consultar sua compra agora. Tente novamente.',true);
        return;
      }
      const {data,error}=await sb.auth.verifyOtp({token_hash:body.token_hash,type:'magiclink'});
      if(error||!data?.session){showMessage('Não foi possível iniciar seu acesso. Tente novamente.',true);return;}
      showMessage('Compra confirmada! Abrindo o aplicativo…');
      const store=window.__clubeUsuarioStore;
      if(store?.getState)await store.getState().init();
      location.replace('/');
    }catch{showMessage('Erro de conexão. Tente novamente.',true)}
    finally{busy=false;submit.disabled=false;submit.textContent='Acessar meu aplicativo';}
  });
  function sync(){const store=window.__clubeUsuarioStore;if(!store?.getState)return;const state=store.getState();if(state.ready)cover.hidden=!!state.user;}
  let attempts=0,subscribed=false;
  const timer=setInterval(()=>{const store=window.__clubeUsuarioStore;attempts++;
    if(store?.subscribe&&!subscribed){subscribed=true;store.subscribe(sync);sync();clearInterval(timer);}
    else if(attempts>=150){clearInterval(timer);showMessage('Não foi possível carregar o aplicativo. Atualize a página.',true);}
  },100);
})();
