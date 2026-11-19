/* Perfil demografico: dispositivo do PRIMEIRO acesso ao aplicativo e idade opcional. */
(()=>{
  'use strict';
  const detectOS=()=>{
    const ua=navigator.userAgent||'', platform=navigator.userAgentData?.platform||navigator.platform||'';
    if(/iPhone|iPad|iPod/i.test(ua)||(/MacIntel/i.test(platform)&&navigator.maxTouchPoints>1)||/iOS/i.test(platform))return 'ios';
    if(/Android/i.test(ua)||/Android/i.test(platform))return 'android';
    if(/Windows|Macintosh|Linux|CrOS/i.test(ua)||/Win|Mac|Linux|Chrome OS/i.test(platform))return 'desktop';
    return 'other';
  };
  const css=`
  #cs-age-layer{position:fixed;inset:0;z-index:2147483590;display:grid;place-items:center;padding:18px;background:rgba(8,31,23,.85);font-family:system-ui,-apple-system,sans-serif}
  #cs-age-card{box-sizing:border-box;position:relative;width:min(100%,420px);max-height:calc(100dvh - 30px);overflow:auto;background:#fffaf1;border:1px solid #dbc58b;border-radius:24px;box-shadow:0 25px 75px #0005;padding:29px 23px 23px;color:#193d2d}
  #cs-age-card .age-mark{font-size:12px;letter-spacing:.13em;font-weight:800;color:#8a743a;text-transform:uppercase}
  #cs-age-card h2{margin:12px 0;font:700 29px/1.15 Georgia,serif;color:#143f2d}
  #cs-age-card p{font:400 14px/1.55 system-ui,sans-serif;margin:0 0 15px;color:#567064}
  #cs-age-card label{display:block;font-size:14px;font-weight:750;margin-bottom:9px}
  #cs-age-card input{width:100%;border:1px solid #cdb985;border-radius:12px;background:white;font-size:18px;color:#183c2c;padding:14px;min-height:53px;box-sizing:border-box}
  #cs-age-card button{width:100%;border:0;cursor:pointer;border-radius:12px;min-height:46px;font-weight:750;font-size:15px;margin-top:12px}
  #cs-age-card button.primary{background:#1c6247;color:white}#cs-age-card button.secondary{background:transparent;color:#506a5a;text-decoration:underline}
  #cs-age-card button:disabled{opacity:.56;cursor:default}
  #cs-age-error{color:#ae342a;font-size:13px;min-height:17px;margin-top:6px}
  #cs-age-card .age-privacy{font-size:12px;color:#62766b;margin:13px 0 0}
  `;
  const sty=document.createElement('style');sty.textContent=css;document.head.append(sty);
  let modal=null, loadedUser=null, pending=false, initialized=false;
  function close(){if(modal){modal.remove();modal=null}}
  function showAge(id){
    close();const layer=document.createElement('div');layer.id='cs-age-layer';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','cs-age-title');
    layer.innerHTML=`<section id="cs-age-card"><span class="age-mark">Seu perfil</span><h2 id="cs-age-title">Qual é a sua idade?</h2><p>Essa informação é opcional.</p><form id="cs-age-form"><label for="cs-age-input">Sua idade (anos completos)</label><input id="cs-age-input" type="number" inputmode="numeric" min="18" max="110" placeholder="Ex.: 35" autocomplete="off" required><div id="cs-age-error" role="alert"></div><button class="primary" type="submit" id="cs-age-submit">Salvar e continuar</button></form><button type="button" id="cs-age-skip" class="secondary">Prefiro não informar</button><p class="age-privacy">A idade e o sistema do primeiro acesso são usados apenas em relatórios agregados. Não coletamos sua data de nascimento.</p></section>`;
    modal=layer;document.body.append(layer);const field=layer.querySelector('#cs-age-input');field.focus({preventScroll:true});
    async function submit(skip){
      if(pending)return;
      const age=skip?null:Number(field.value);
      if(!skip&&(!Number.isInteger(age)||age<18||age>110)){layer.querySelector('#cs-age-error').textContent='Informe uma idade entre 18 e 110 anos, ou escolha não informar.';return}
      const svc=window.__clubeSupabase,store=window.__clubeUsuarioStore;
      if(!svc||store?.getState?.().user?.id!==id){close();return}
      pending=true;layer.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{
        const {data,error}=await svc.rpc('clube_salvar_demografia',{p_os:detectOS(),p_age:age,p_skip_age:Boolean(skip)});
        if(error)throw error;
        if(loadedUser===id)close();
      }catch(err){layer.querySelector('#cs-age-error').textContent='Não foi possível salvar. Confira sua conexão e tente novamente.';console.warn('[Perfil]',err?.message||err)}
      finally{pending=false;if(layer.isConnected)layer.querySelectorAll('button').forEach(b=>b.disabled=false)}
    }
    layer.querySelector('form').addEventListener('submit',e=>{e.preventDefault();submit(false)});
    layer.querySelector('#cs-age-skip').addEventListener('click',()=>submit(true));
  }
  async function load(user){
    if(!user?.id)return;
    const id=user.id;loadedUser=id;
    try{
      const svc=window.__clubeSupabase;
      const {data:auth,error:authError}=await svc.auth.getUser();
      if(authError||auth?.user?.id!==id)return;
      const {data,error}=await svc.rpc('clube_salvar_demografia',{p_os:detectOS(),p_age:null,p_skip_age:false});
      if(error)throw error;
      if(loadedUser!==id||window.__clubeUsuarioStore?.getState?.().user?.id!==id)return;
      if(data?.age==null&&!data?.age_skipped)showAge(id);
    }catch(err){console.warn('[Perfil] Para ativar o relatorio, execute 06_PERFIL_COMPRADORES.sql:',err?.message||err)}
  }
  function init(){const store=window.__clubeUsuarioStore;
    if(initialized||!store?.subscribe||!store?.getState||!window.__clubeSupabase)return false;
    initialized=true;
    const sync=()=>{const s=store.getState();if(!s.ready)return;const u=s.user;
      if(!u){loadedUser=null;close();return}
      if(u.mustChangePassword)return; // primeiro a troca da senha provisoria
      if(u.id!==loadedUser)load(u);
    };
    store.subscribe(sync);sync();return true;
  }
  window.addEventListener('clube:editar-idade',()=>{if(loadedUser)showAge(loadedUser)});
  let tries=0;const interval=setInterval(()=>{if(init()||++tries>160)clearInterval(interval)},250);
})();
