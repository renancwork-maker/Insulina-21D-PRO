/* Registro individual de atividade para /admin.
 * Nenhuma informacao de pagamento, senha, data de nascimento ou conteudo pessoal e enviada.
 * O sistema mede PRESENCA ESTIMADA (heartbeat recente), nao websocket em tempo real.
 * Instalacao iOS nao emite evento; registro so e feito ao abrir em modo standalone.
 */
(()=>{
 'use strict';
 const OS=()=>{
  const ua=navigator.userAgent||'',p=navigator.userAgentData?.platform||navigator.platform||'';
  if(/iPhone|iPad|iPod/i.test(ua)||(/MacIntel/.test(p)&&navigator.maxTouchPoints>1))return 'ios';
  if(/Android/i.test(ua)||/Android/i.test(p))return 'android';
  if(/Windows|Macintosh|Linux|CrOS/i.test(ua)||/Win|Mac|Linux|Chrome OS/i.test(p))return 'desktop';
  return 'other';
 };
 const standalone=()=>Boolean(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true);
 let trackedUser=null,storeReady=false,lastPing=0,installPending=false;
 let queue=Promise.resolve();
 function authorized(){
  const s=window.__clubeUsuarioStore?.getState?.();
  return s?.ready && s.user?.id && !s.user.mustChangePassword ? s.user.id : null;
 }
 function publish(event){
  const userId=authorized(),svc=window.__clubeSupabase;
  if(!userId||!svc||document.visibilityState==='hidden')return;
  // Eventos em fila, evitando respostas fora de ordem na primeira abertura.
  queue=queue.catch(()=>{}).then(async()=>{
   if(authorized()!==userId)return;
   const {error}=await svc.rpc('clube_registrar_atividade',{p_event:event,p_os:OS()});
   if(error){console.warn('[Atividade app]',error.message||error);return;}
   if(event==='heartbeat'||event==='open')lastPing=Date.now();
  });
 }
 function ping(force){
  if(!authorized()||document.visibilityState!=='visible')return;
  if(force||Date.now()-lastPing>=35000)publish('heartbeat');
 }
 function markPwa(){
  if(standalone())publish('pwa_open');
  if(installPending){publish('pwa_installed');installPending=false;}
 }
 function sync(){
  const id=authorized();
  if(!id){trackedUser=null;return;}
  if(id!==trackedUser){trackedUser=id;publish('open');markPwa();}
 }
 window.addEventListener('appinstalled',()=>{
  installPending=true;
  if(authorized()&&document.visibilityState==='visible'){publish('pwa_installed');installPending=false;}
 });
 window.addEventListener('clube:authenticated',sync);
 window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){sync();if(installPending && authorized()){publish('pwa_installed');installPending=false;}ping(true);}});
 window.addEventListener('focus',()=>ping(false));
 window.addEventListener('pageshow',()=>{sync();ping(false);});
 // So registrar online se a pagina estiver visivel; apos sair, o status expira em ate 2 min.
 setInterval(()=>{sync();ping(false)},45000);
 const initTimer=setInterval(()=>{
  const store=window.__clubeUsuarioStore;
  if(storeReady||!store?.subscribe||!store?.getState||!window.__clubeSupabase)return;
  storeReady=true;clearInterval(initTimer);store.subscribe(sync);sync();
 },250);
 setTimeout(()=>clearInterval(initTimer),60000);
})();
