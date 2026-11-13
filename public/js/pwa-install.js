(function(){
'use strict';
let pendingInstall=null,shownThisSession=false;
const ua=navigator.userAgent||'';
const isIOS=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isAndroid=/Android/i.test(ua);
const isPhone=isIOS||isAndroid;
const isStandalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
// Registrar service worker inclusive em computadores, mas NÃO exibir guias ou botões no desktop.
if('serviceWorker' in navigator&&(location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{}));}
if(!isPhone||isStandalone)return;
const st=document.createElement('style');st.textContent=`
#cs-install-toggle{position:fixed;right:14px;bottom:calc(15px + env(safe-area-inset-bottom,0px));z-index:2147483000;background:#153b2f;color:#f3e2b1;border:1px solid #c2a45d;border-radius:22px;padding:11px 16px;font:700 13px system-ui;box-shadow:0 9px 26px #0003;cursor:pointer;display:none}
#cs-install-overlay{position:fixed;inset:0;z-index:2147483500;background:#061c15ce;display:none;align-items:center;justify-content:center;padding:18px}
#cs-install-modal{background:#fcf8ef;border:1px solid #d9c086;border-radius:22px;color:#1a3c2e;box-shadow:0 18px 48px #0006;width:min(100%,420px);max-height:88vh;overflow:auto;padding:25px 23px;position:relative;font:15px/1.55 system-ui}
#cs-install-modal h2{font:800 23px/1.22 system-ui;margin:0 25px 12px 0}
#cs-install-modal p{margin:10px 0}#cs-install-modal ol{padding-left:22px}#cs-install-modal li{margin:10px 0}
#cs-install-close{position:absolute;right:10px;top:8px;border:0;background:transparent;color:#173e2c;font-size:28px;cursor:pointer}
#cs-install-native{width:100%;background:#164e38;color:#fff;border:0;border-radius:12px;padding:13px;font-weight:750;cursor:pointer}
@media(max-width:390px){#cs-install-modal{padding:23px 17px}}
`;document.head.appendChild(st);
const toggle=document.createElement('button');toggle.id='cs-install-toggle';toggle.type='button';toggle.textContent='📲 Salvar aplicativo';
const overlay=document.createElement('div');overlay.id='cs-install-overlay';overlay.setAttribute('role','presentation');
overlay.innerHTML='<section id="cs-install-modal" role="dialog" aria-modal="true" aria-labelledby="cs-install-title"><button type="button" id="cs-install-close" aria-label="Fechar">×</button><h2 id="cs-install-title">Tenha o Clube do Segredo na tela inicial 📲</h2><p>Salve o aplicativo no celular para abrir diretamente pelo ícone, sem precisar procurar o link.</p><div id="cs-install-steps"></div><button type="button" id="cs-install-native" hidden>Instalar agora</button><p style="font-size:12px;color:#667c70">É preciso ter internet para fazer login e sincronizar os conteúdos.</p></section>';
document.body.append(toggle,overlay);
const close=()=>overlay.style.display='none';
overlay.querySelector('#cs-install-close').addEventListener('click',close);
overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
const steps=overlay.querySelector('#cs-install-steps'),install=overlay.querySelector('#cs-install-native');
function render(){if(isIOS){steps.innerHTML='<strong>iPhone / iPad — Safari</strong><ol><li>Se estiver em outro navegador, abra este endereço no <b>Safari</b>.</li><li>Toque no botão <b>Compartilhar</b> (quadrado com seta para cima) ou abra o menu do Safari.</li><li>Toque em <b>Adicionar à Tela de Início</b>.</li><li>Confirme em <b>Adicionar</b> e, se disponível, ative <b>Abrir como App</b>.</li><li>Toque no ícone <b>Clube do Segredo</b> na tela inicial.</li></ol>';install.hidden=true;}
else{steps.innerHTML='<strong>Android — Google Chrome</strong><ol><li>Abra este site no <b>Google Chrome</b>.</li><li>Toque no menu <b>⋮</b> (três pontos).</li><li>Selecione <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.</li><li>Confirme e abra o ícone <b>Clube do Segredo</b> no celular.</li></ol>';install.hidden=!pendingInstall;}}
function show(){render();overlay.style.display='flex';}
toggle.addEventListener('click',show);
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();pendingInstall=e;render();});
install.addEventListener('click',async()=>{if(!pendingInstall)return;const ev=pendingInstall;pendingInstall=null;ev.prompt();try{await ev.userChoice;}catch(_){}close();});
window.addEventListener('appinstalled',()=>{toggle.remove();close();});
window.addEventListener('clube:authenticated',event=>{
  const userId=event.detail&&event.detail.id||'user';
  toggle.style.display='block';
  // Uma apresentação automática por usuário neste navegador; o botão permanece para reabrir.
  const key='clube:pwa-guide-shown:'+userId;
  if(shownThisSession)return;
  shownThisSession=true;
  try{if(localStorage.getItem(key))return;localStorage.setItem(key,'1');}catch(_){}
  show();
});
})();
