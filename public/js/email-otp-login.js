/* Clube do Segredo | login sem senha, Supabase Email OTP + Resend SMTP.
 * O código é produzido/validado pelo Supabase; não armazenar nem validar códigos no navegador.
 */
(()=>{'use strict';
  if (/^\/(admin|criar-senha|recuperar-senha|ativar)(\/|$)/.test(location.pathname)) return;
  const styles=`
  #cs-otp-cover {position:fixed;inset:0;z-index:2147483600;overflow-y:auto;background:linear-gradient(155deg,#153e30,#225941);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Poppins,system-ui,sans-serif;color:#153e30;}
  #cs-otp-cover[hidden]{display:none!important}
  #cs-otp-card{max-width:440px;width:100%;background:#fffdf5;border-radius:24px;padding:28px 24px;box-shadow:0 20px 60px #081b1666}
  #cs-otp-card h1{font-size:25px;font-weight:800;line-height:1.2;margin:0 0 10px}
  #cs-otp-card p{font-size:14px;line-height:1.55;color:#50685c}
  #cs-otp-card label{font-size:14px;font-weight:700;display:block;margin-bottom:8px}
  #cs-otp-card input{box-sizing:border-box;width:100%;border:1px solid #b7c9bf;border-radius:12px;padding:16px;font-size:16px;background:white;color:#153e30}
  #cs-otp-card input:focus{outline:2px solid #8fba9e;outline-offset:2px}
  #cs-otp-card button.primary{width:100%;background:#196747;border:0;border-radius:12px;color:#fff;font-weight:750;font-size:16px;padding:15px;margin-top:14px;cursor:pointer}
  #cs-otp-card button:disabled{opacity:.55;cursor:wait}
  #cs-otp-card button.secondary{border:0;background:transparent;color:#196747;font-weight:700;padding:10px;cursor:pointer}
  #cs-otp-msg{margin-top:13px;font-size:14px;line-height:1.5;min-height:1.3em}
  #cs-otp-msg.error{color:#a92323}
  .cs-spam{background:#fff1cf;border:1px solid #d2a74d;padding:14px;border-radius:12px;color:#6b4b08;margin:15px 0;font-size:14px;line-height:1.5}
  .cs-help{font-size:12px!important;text-align:center;margin-top:18px!important}
  .cs-help a{color:#196747;font-weight:700;text-decoration:underline}
  .cs-eyebrow{letter-spacing:.11em;color:#307753;font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:12px}
  `;
  const style=document.createElement('style');style.textContent=styles;document.head.appendChild(style);
  const cover=document.createElement('div');cover.id='cs-otp-cover';cover.setAttribute('role','main');
  cover.innerHTML=`<section id="cs-otp-card" aria-label="Acesso por código de e-mail">
    <div class="cs-eyebrow">Segredo da Insulina • 21 dias</div>
    <h1 id="cs-otp-title">Entre no seu aplicativo</h1>
    <p id="cs-otp-intro">Informe apenas o e-mail utilizado na compra. Não precisa de senha.</p>
    <form id="cs-otp-form" novalidate>
      <div id="cs-otp-email-stage"><label for="cs-otp-email">E-mail utilizado na compra</label><input id="cs-otp-email" type="email" autocomplete="email" inputmode="email" required placeholder="seuemail@exemplo.com" maxlength="254"/></div>
      <div id="cs-otp-code-stage" hidden><label for="cs-otp-code">Código recebido por e-mail</label><input id="cs-otp-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" aria-describedby="cs-otp-spam"/>
        <div class="cs-spam" id="cs-otp-spam"><strong>Confira primeiro a pasta SPAM ou Lixo eletrônico!</strong><br>O código pode estar lá. Procure por <strong>Clube do Segredo</strong> no e-mail.</div>
      </div>
      <button class="primary" id="cs-otp-submit" type="submit">Receber código de acesso</button>
    </form>
    <p id="cs-otp-msg" aria-live="polite"></p>
    <div id="cs-otp-actions" hidden><button id="cs-otp-back" type="button" class="secondary">Alterar e-mail</button><button id="cs-otp-resend" type="button" class="secondary" disabled>Reenviar código (60s)</button></div>
    <p class="cs-help">Não encontrou o código? Confira também o spam.<br><a href="https://wa.me/5511932383351" target="_blank" rel="noopener noreferrer">Preciso de ajuda no WhatsApp</a></p>
  </section>`;
  document.body.appendChild(cover);
  const $=id=>document.getElementById(id), emailInput=$('cs-otp-email'),codeInput=$('cs-otp-code'),submit=$('cs-otp-submit'),msg=$('cs-otp-msg');
  let step=1,email='',pending=false,resendUntil=0;
  const client=()=>window.__clubeSupabase;
  const store=()=>window.__clubeUsuarioStore;
  const message=(t,isError=false)=>{msg.textContent=t;msg.className=isError?'error':''};
  const busy=(value)=>{pending=value;submit.disabled=value;submit.textContent=value?(step===1?'Enviando código…':'Verificando código…'):(step===1?'Receber código de acesso':'Validar código e entrar')};
  const updateResend=()=>{const left=Math.ceil((resendUntil-Date.now())/1000);$('cs-otp-resend').disabled=pending||left>0;$('cs-otp-resend').textContent=left>0?`Reenviar código (${left}s)`:'Reenviar código'};
  const tick=setInterval(()=>{if(document.getElementById('cs-otp-resend'))updateResend();else clearInterval(tick)},1000);
  const showCode=()=>{step=2;$('cs-otp-email-stage').hidden=true;$('cs-otp-code-stage').hidden=false;$('cs-otp-actions').hidden=false;$('cs-otp-title').textContent='Digite seu código';$('cs-otp-intro').textContent=`Enviamos um código de 6 dígitos para ${email}.`;$('cs-otp-code').focus();busy(false)};
  const showEmail=()=>{step=1;$('cs-otp-email-stage').hidden=false;$('cs-otp-code-stage').hidden=true;$('cs-otp-actions').hidden=true;$('cs-otp-title').textContent='Entre no seu aplicativo';$('cs-otp-intro').textContent='Informe apenas o e-mail utilizado na compra. Não precisa de senha.';codeInput.value='';busy(false);message('');emailInput.focus()};
  const send=async()=>{
    if(pending)return;const sb=client();if(!sb){message('O sistema de acesso ainda está carregando. Tente novamente.',true);return}
    if(step===1){email=emailInput.value.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){message('Digite um e-mail válido.',true);return}}
    if(step===2&&Date.now()<resendUntil)return;
    busy(true);message('');
    try{
      const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
      if(error){
        if(/rate.limit|seconds|too many|over.email|429/i.test(error.message))message('Aguarde um pouco antes de pedir outro código.',true);
        else message('Não foi possível enviar o código agora. Verifique o e-mail e tente novamente ou fale com o suporte.',true);
        return;
      }
      resendUntil=Date.now()+60000;
      if(step===1)showCode();
      message('Código solicitado. Confira a caixa de entrada e principalmente o SPAM.');
    }catch{message('Falha de conexão. Confira a internet e tente novamente.',true)}
    finally{busy(false);updateResend()}
  };
  $('cs-otp-form').addEventListener('submit',async ev=>{
    ev.preventDefault();if(pending)return;
    if(step===1){await send();return}
    const token=codeInput.value.replace(/\D/g,'');if(token.length!==6){message('Digite os 6 números do código recebido.',true);return}
    busy(true);message('');try{
      const sb=client();if(!sb)throw Error('not_ready');
      const {data,error}=await sb.auth.verifyOtp({email,token,type:'email'});
      if(error||!data?.session){message('Código incorreto ou expirado. Confira o e-mail mais recente e tente de novo.',true);return}
      const st=store();if(!st?.getState){message('Código validado! Finalizando seu acesso…');location.replace('/');return}
      await st.getState().init();
      if(st.getState().user){cover.hidden=true;location.replace('/');return}
      message('Código validado, mas seu cadastro não liberou o conteúdo. Fale com nosso suporte com o e-mail da compra.',true);
    }catch{message('Não foi possível confirmar o código. Tente novamente.',true)}finally{busy(false)}
  });
  $('cs-otp-resend').addEventListener('click',send);
  $('cs-otp-back').addEventListener('click',showEmail);
  const sync=()=>{const st=store();if(!st?.getState)return;const state=st.getState();if(state.ready){cover.hidden=!!state.user;}}
  let subscribed=false,tries=0;
  const readiness=setInterval(()=>{tries++;const st=store();if(st?.subscribe&&!subscribed){subscribed=true;st.subscribe(sync);sync();clearInterval(readiness)} else if(tries>120){clearInterval(readiness);message('Não foi possível carregar o aplicativo. Atualize a página ou procure o suporte.',true)}},100);
})();
