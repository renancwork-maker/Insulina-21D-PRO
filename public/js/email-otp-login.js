(()=>{'use strict';
  if (/^\/(admin|ativar|recuperar-senha)(\/|$)/.test(location.pathname)) return;
  const params=new URLSearchParams(location.search);if(!params.has('privado')&&!params.has('novo')){try{if(localStorage.getItem('clube-simple-current'))fetch('/api/purchase-direct-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'simple-status'})}).then(r=>{if(r.ok)location.replace('/acesso-simples.html');else if(r.status===401){localStorage.removeItem('clube-simple-current')}}).catch(()=>{})}catch{}}
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
    <p>Digite o e-mail ou celular da compra. Sem senha e sem código.</p>
    <div class="cs-update" style="background:#e5f2e5;border:1px solid #a8c5ac;border-radius:12px;padding:12px;margin:14px 0"><strong>Temos novidades para você!</strong><p style="margin:6px 0 0">O aplicativo ficou mais simples! Sua compra continua válida.</p></div><form id="cs-direct-form" novalidate>
      <label for="cs-direct-id">E-mail ou celular da compra</label>
      <input id="cs-direct-id" type="text" autocomplete="username" required placeholder="E-mail ou celular com DDD" maxlength="254"/>
      <div id="cs-code-row" hidden><label for="cs-code">Código recebido por e-mail</label><input id="cs-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="Código de acesso"></div><button id="cs-direct-submit" type="submit">Entrar no aplicativo</button><button id="cs-private" type="button" style="background:#e8eee6;color:#173d2c">Acessar meus dados e fotos salvos</button><button id="cs-resend" type="button" hidden>Reenviar código</button><button id="cs-change" type="button" hidden>Alterar e-mail ou celular</button>
    </form>
    <p id="cs-direct-msg" role="status" aria-live="polite"></p>
    <p class="cs-help">Não localizou sua compra? <a href="mailto:suporte@digitalco.site?subject=Ajuda%20com%20meu%20acesso">Fale com o suporte</a>.</p>
  </section>`;
  document.body.appendChild(cover);
  const form=document.getElementById('cs-direct-form');
  const field=document.getElementById('cs-direct-id');
  const submit=document.getElementById('cs-direct-submit');
  const msg=document.getElementById('cs-direct-msg');
  let busy=false, sent=false, privateMode=false, checkedToken=null, syncSeq=0;
  const privateButton=document.getElementById("cs-private");
  const code=document.getElementById('cs-code'), codeRow=document.getElementById('cs-code-row'), resend=document.getElementById('cs-resend'), change=document.getElementById('cs-change');
  function showMessage(text,error=false){msg.textContent=text;msg.className=error?'error':'';}
  async function process(sendOnly=false){
    if(busy)return;const identifier=field.value.trim(),sb=window.__clubeSupabase;
    if(!identifier||!sb){showMessage('Informe os dados da compra e tente novamente.',true);return;}
    const action=!privateMode?'direct':(!sent||sendOnly)?'send':'verify';if(action==='verify'&&!/^\d{6,10}$/.test(code.value.trim())){showMessage('Digite o código recebido.',true);return;}
    busy=true;submit.disabled=resend.disabled=true;showMessage('');
    try{
      const res=await fetch('/api/purchase-direct-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,action,code:action==='verify'?code.value.trim():undefined})});const body=await res.json();
      if(!res.ok){showMessage(body.error==='purchase_not_found'?'Compra não localizada. Confira o e-mail ou celular informado.':body.error==='invalid_code'?'Código incorreto ou expirado. Confira ou solicite outro.':'Não foi possível continuar. Tente novamente ou fale com o suporte.',true);return;}
      if(action==='direct'){try{localStorage.removeItem('clube-simple-current')}catch{}sessionStorage.removeItem('clube-simple-tab-v1');location.assign('/acesso-simples.html');return;}
      if(action==='send'){sent=true;field.readOnly=true;codeRow.hidden=resend.hidden=change.hidden=false;code.focus();showMessage('Se houver uma compra aprovada, o código chegará ao e-mail da compra. Confira o spam.');return;}
      const {error}=await sb.auth.setSession({access_token:body.access_token,refresh_token:body.refresh_token});if(error)throw error;
      location.replace('/'+location.search);
    }catch{showMessage('Não foi possível concluir o acesso. Tente novamente.',true)}
    finally{busy=false;submit.disabled=resend.disabled=false;submit.textContent=sent?'Confirmar código':privateMode?'Enviar código':'Entrar no aplicativo';}
  }
  privateButton.addEventListener('click',()=>{if(busy)return;privateMode=true;change.hidden=false;change.textContent='Voltar ao acesso sem código';submit.textContent='Enviar código';showMessage('Para proteger seus dados e fotos, enviaremos um código ao e-mail da compra.');if(field.value.trim())process();else field.focus();});
  form.addEventListener('submit',e=>{e.preventDefault();process()});resend.addEventListener('click',()=>process(true));change.addEventListener('click',()=>{if(busy)return;sent=false;privateMode=false;field.readOnly=false;codeRow.hidden=resend.hidden=change.hidden=true;code.value='';submit.textContent='Entrar no aplicativo';showMessage('');field.focus()});
  function updateNotice(){if(sessionStorage.getItem('clube-update-v3')||document.getElementById('cs-update-banner'))return;const b=document.createElement('aside');b.id='cs-update-banner';b.setAttribute('role','region');b.setAttribute('aria-label','Novidades do aplicativo');b.style.cssText='position:fixed;z-index:2147483400;bottom:12px;left:12px;right:12px;max-width:460px;margin:auto;padding:16px;background:#fffdf5;color:#173d2c;border:2px solid #8cb79b;border-radius:16px;box-shadow:0 8px 28px #0004;font:16px/1.45 system-ui';b.innerHTML='<strong>💚 Temos novidades para você!</strong><p>Atualizamos o aplicativo para facilitar sua jornada de emagrecimento, com cardápio personalizado, frutas, hidratação e acompanhamento dos 21 dias. Sua compra continua válida.</p><button type="button" style="width:100%;padding:12px;border:0;border-radius:10px;background:#196747;color:white;font-weight:700;font-size:16px">Entendi</button>';b.querySelector('button').onclick=()=>{sessionStorage.setItem('clube-update-v3','1');b.remove()};document.body.append(b);}
  async function sync(){const store=window.__clubeUsuarioStore,sb=window.__clubeSupabase;if(!store?.getState||!sb)return;const state=store.getState();if(!state.ready)return;const seq=++syncSeq;if(!state.user){document.getElementById('cs-update-banner')?.remove();cover.hidden=false;checkedToken=null;return;}
    const {data}=await sb.auth.getSession();const token=data?.session?.access_token;if(seq!==syncSeq)return;
    if(token&&token===checkedToken)return;cover.hidden=false;
    const result=await sb.rpc('clube_protocolo_sessao_segura');if(seq!==syncSeq)return;
    if(!result.error&&result.data===true){checkedToken=token;cover.hidden=true;window.dispatchEvent(new Event('clube:protocolo-seguro'));}
    else {checkedToken=result.error?null:token;cover.hidden=false;field.value=state.user.email||'';showMessage(result.error?'Configuração de segurança pendente. Fale com o suporte.':'Confirme seu e-mail para proteger seu perfil e fotos.');}
  }
  if(new URLSearchParams(location.search).get('privado')==='1'){privateMode=true;change.hidden=false;change.textContent='Voltar ao acesso sem código';submit.textContent='Enviar código';showMessage('Entre com o e-mail ou celular da compra para recuperar seus dados privados.');}
  let attempts=0,subscribed=false;
  const timer=setInterval(()=>{const store=window.__clubeUsuarioStore;attempts++;
    if(store?.subscribe&&!subscribed){subscribed=true;store.subscribe(sync);window.__clubeSupabase?.auth.onAuthStateChange(()=>setTimeout(sync,0));sync();clearInterval(timer);}
    else if(attempts>=150){clearInterval(timer);showMessage('Não foi possível carregar o aplicativo. Atualize a página.',true);}
  },100);
})();
