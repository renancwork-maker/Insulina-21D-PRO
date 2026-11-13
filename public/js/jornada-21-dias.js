/* Jornada de 21 dias - data exclusiva por usuario autenticado no Supabase. */
(()=>{
  'use strict';
  const css=`
  #jornada-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(9,32,24,.78);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;font-family:system-ui,-apple-system,sans-serif}
  #jornada-modal{background:#fffaf0;color:#183b2c;width:min(100%,450px);max-height:calc(100dvh - 40px);overflow:auto;border-radius:25px;padding:26px 22px;box-shadow:0 20px 65px #0006}
  #jornada-modal h2{font:700 27px/1.13 Georgia,serif;margin:10px 0 12px;color:#143e2c}
  #jornada-modal p{font-size:14px;line-height:1.55;color:#4b6257}
  #jornada-modal label{display:block;font-size:14px;font-weight:650;margin:16px 0 8px}
  #jornada-modal input[type=date]{width:100%;border:1px solid #ceb98a;background:#fff;border-radius:12px;padding:13px;font:inherit;box-sizing:border-box;min-height:48px;color:#183b2c}
  #jornada-modal .checkrow{display:flex;gap:11px;align-items:flex-start;margin:14px 0;background:#f1ead8;border-radius:12px;padding:12px;cursor:pointer}
  #jornada-modal .checkrow input{width:21px;height:21px;accent-color:#1c6547;flex-shrink:0;margin-top:2px}
  #jornada-modal .checkrow span{line-height:1.45;font-size:14px}
  #jornada-modal a{color:#1c674c;font-weight:700;text-decoration:underline;text-underline-offset:2px}
  #jornada-modal button[type=submit]{width:100%;padding:14px;border:0;border-radius:13px;background:#194a34;color:white;font-size:16px;font-weight:750;cursor:pointer;margin-top:10px}
  #jornada-modal button:disabled{opacity:.55;cursor:not-allowed}
  #jornada-modal .secondary{background:none;border:0;color:#5b7063;padding:12px;cursor:pointer;text-decoration:underline;width:100%;font-size:13px}
  #jornada-modal #jornada-msg{min-height:18px;font-size:13px;color:#a32824;margin-top:9px}
  #jornada-modal .jornada-chip{display:inline-block;font-size:11px;letter-spacing:.12em;color:#b08a37;font-weight:800;text-transform:uppercase}
  `;
  const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const asDate=v=>typeof v==='string'?v.slice(0,10):'';
  const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T12:00:00').getTime());
  let activeId=null, savedDate=null, inProgress=false, initialLoaded=false, currentUser=null, pop=null;
  const getSvc=()=>window.__clubeSupabase;
  const getStore=()=>window.__clubeUsuarioStore;
  function hide(){if(pop){pop.remove();pop=null}}
  function notice(msg){const el=document.getElementById('jornada-msg');if(el)el.textContent=msg||''}
  function render(edit){
    hide();const container=document.createElement('div');container.id='jornada-overlay';container.setAttribute('role','dialog');container.setAttribute('aria-modal','true');container.setAttribute('aria-labelledby','jornada-heading');
    const initial=savedDate||today();
    container.innerHTML=`<section id="jornada-modal">
      <span class="jornada-chip">Sua jornada • 21 dias</span>
      <h2 id="jornada-heading">${edit?'Alterar início da sua jornada':'Quando você vai começar?'}</h2>
      <p>Antes de iniciar, confira se você já tem em casa <strong>todos os ingredientes da lista de compras</strong>. Se ainda faltar algo, escolha um dia futuro para se organizar.</p>
      <p><a href="/materiais/lista-compras-21-dias.html" target="_blank" rel="noopener">🛒 Abrir lista de compras completa</a></p>
      <form id="jornada-form">
        <label class="checkrow"><input type="checkbox" id="jornada-pronto" ${edit?'checked':''}><span>Já conferi a lista e tenho os ingredientes necessários para o dia em que vou começar.</span></label>
        <label for="jornada-data">Escolha o primeiro dia da sua jornada:</label>
        <input type="date" id="jornada-data" required value="${initial}" min="${edit&&savedDate&&savedDate<today()?savedDate:today()}">
        <p>O dia escolhido será o <b>Dia 1</b>. A cada novo dia do calendário, sua jornada avançará automaticamente, até o Dia 21, mesmo que você feche o aplicativo.</p>
        <div id="jornada-msg" role="alert"></div>
        <button type="submit" id="jornada-confirmar">${edit?'Salvar data de início':'Confirmar e preparar meus 21 dias'}</button>
        ${edit?'<button class="secondary" type="button" id="jornada-cancelar">Cancelar</button>':''}
      </form></section>`;
    pop=container;document.body.appendChild(container);
    if(edit){const cancel=container.querySelector('#jornada-cancelar');cancel.addEventListener('click',hide)}
    container.querySelector('#jornada-form').addEventListener('submit',async ev=>{
      ev.preventDefault();if(inProgress)return;
      const ready=container.querySelector('#jornada-pronto').checked;
      const selected=container.querySelector('#jornada-data').value;
      if(!ready){notice('Confira os ingredientes e marque a confirmação para continuar.');return}
      if(!valid(selected)){notice('Selecione uma data válida.');return}
      if(selected<today()&&!(edit&&selected===savedDate)){notice('Escolha hoje ou uma data futura.');return}
      const store=getStore(),svc=getSvc(),id=store?.getState?.().user?.id;
      if(!id||!svc){notice('Sua sessão expirou. Entre novamente no aplicativo.');return}
      inProgress=true;const btn=container.querySelector('#jornada-confirmar');btn.disabled=true;btn.textContent='Salvando sua jornada…';notice('');
      try{
        // Identidade comprovada pela sessao do Supabase e RLS no banco.
        const {data:auth,error:authError}=await svc.auth.getUser();
        if(authError||auth?.user?.id!==id)throw new Error('Sua sessão precisa ser renovada. Entre novamente.');
        const {error}=await svc.from('journey_starts').upsert({user_id:id,start_date:selected,ingredients_confirmed:true},{onConflict:'user_id'});
        if(error)throw error;
        savedDate=selected;store.getState().updateUser({startDate:selected});hide();
      }catch(e){notice(e?.code==='42P01'||e?.code==='PGRST205'?'Falta executar o SQL 04_JORNADA_21_DIAS.sql no Supabase.':e?.message||'Não foi possível salvar. Tente novamente.');}
      finally{inProgress=false;if(btn.isConnected){btn.disabled=false;btn.textContent=edit?'Salvar data de início':'Confirmar e preparar meus 21 dias'}}
    });
  }
  async function load(user){
    const svc=getSvc(),store=getStore();if(!svc||!store||!user?.id)return;
    const userId=user.id;activeId=userId;initialLoaded=false;savedDate=null;
    try{
      const {data:auth,error:aerr}=await svc.auth.getUser();
      if(aerr||auth?.user?.id!==userId)return;
      const {data,error}=await svc.from('journey_starts').select('start_date').eq('user_id',userId).maybeSingle();
      if(activeId!==userId||store.getState().user?.id!==userId)return;
      if(error){console.warn('[Jornada] Não foi possível consultar a data:',error.message);render(false);notice('Não foi possível consultar o calendário. Verifique se o SQL da jornada foi executado no Supabase.');return}
      if(data?.start_date){savedDate=asDate(data.start_date);store.getState().updateUser({startDate:savedDate});hide()}
      else{store.getState().updateUser({startDate:null});render(false)}
      initialLoaded=true;
    }catch(e){console.warn('[Jornada]',e);if(activeId===userId){render(false);notice('Falha de conexão. Tente novamente quando estiver online.')}}
  }
  window.addEventListener('clube:alterar-inicio',()=>{if(currentUser&&activeId===currentUser.id)render(!!savedDate)});
  let subscribed=false;
  function init(){const store=getStore();if(!store||subscribed)return false;subscribed=true;
    const sync=()=>{const st=store.getState(),user=st.user;
      if(!st.ready)return;
      if(!user){activeId=null;savedDate=null;initialLoaded=false;currentUser=null;hide();return}
      currentUser=user;
      if(user.id!==activeId)load(user);
    };
    store.subscribe(sync);sync();return true;
  }
  // Atualiza automaticamente a tela na virada do dia, mesmo com o app aberto.
  let dayLastSeen=today();
  setInterval(()=>{
    const now=today();
    if(now===dayLastSeen)return;
    dayLastSeen=now;
    const st=getStore()?.getState?.();
    if(st?.user&&savedDate&&activeId===st.user.id)st.updateUser({startDate:savedDate});
  },30000);
  let attempts=0;const poll=setInterval(()=>{if(init()||++attempts>150)clearInterval(poll)},250);
})();
