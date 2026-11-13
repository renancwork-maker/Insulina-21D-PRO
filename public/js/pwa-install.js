(function () {
  'use strict';
  const ua=navigator.userAgent || '';
  const isIOS=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isAndroid=/Android/i.test(ua);
  const isMobile=isIOS||isAndroid;
  const isStandalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  let deferredInstall=null;
  let shownThisSession=false;
  if('serviceWorker' in navigator && (location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname))) {
    addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{}));
  }
  // Nenhum pop-up ou botão de instalação em PCs, notebooks ou no PWA já instalado.
  if(!isMobile||isStandalone) return;
  const style=document.createElement('style');
  style.textContent=`
#cs-install-toggle{position:fixed;right:14px;bottom:calc(15px + env(safe-area-inset-bottom,0px));z-index:2147483000;background:#153b2f;color:#f3e2b1;border:1px solid #c2a45d;border-radius:22px;padding:11px 16px;font:700 13px system-ui;box-shadow:0 9px 26px #0003;cursor:pointer;display:none}
#cs-install-overlay{position:fixed;inset:0;z-index:2147483500;background:rgba(4,25,18,.84);display:none;align-items:center;justify-content:center;padding:12px;overscroll-behavior:contain}
#cs-install-modal{background:#fcf8ef;border:1px solid #d9c086;border-radius:20px;color:#1a3c2e;box-shadow:0 18px 48px #0006;width:min(100%,440px);max-height:min(92dvh,840px);overflow:auto;padding:24px 18px;position:relative;font:15px/1.5 system-ui;-webkit-overflow-scrolling:touch}
#cs-install-modal h2{font:800 22px/1.22 system-ui;margin:0 35px 8px 0}
#cs-install-modal p{margin:9px 0}#cs-install-modal ol{padding-left:22px;margin:12px 0}#cs-install-modal li{margin:9px 0}
#cs-install-close{position:absolute;right:12px;top:9px;border:0;background:transparent;color:#173e2c;font-size:30px;cursor:pointer;line-height:1}
#cs-install-native{width:100%;background:#164e38;color:#fff;border:0;border-radius:12px;padding:13px;font-weight:750;cursor:pointer;margin:10px 0}
#cs-install-video{display:block;width:100%;max-height:240px;aspect-ratio:9/16;background:#0b1e17;border-radius:12px;object-fit:contain}
.cs-install-video-label{margin:12px 0 7px!important;font-weight:750;color:#183b2c}
#cs-install-gallery{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;margin:12px 0 7px}
.cs-install-thumb{border:2px solid transparent;padding:0;border-radius:7px;overflow:hidden;background:#e8e4d9;cursor:pointer;aspect-ratio:9/16}
.cs-install-thumb[aria-pressed=true]{border-color:#b38d37}
.cs-install-thumb img{display:block;width:100%;height:100%;object-fit:cover}
#cs-install-figure{border-radius:12px;margin:0;background:#e9e5dc;padding:10px;text-align:center}
#cs-install-step-image{display:block;width:auto;max-width:100%;height:auto;max-height:360px;margin:auto;object-fit:contain;border-radius:7px}
#cs-install-figure figcaption{font-size:13px;color:#2e483a;font-weight:600;margin-top:8px}
.cs-install-arrows{display:flex;gap:8px;justify-content:space-between;margin:9px 0 14px}
.cs-install-arrows button{background:#204c38;color:#fff;border:0;border-radius:10px;padding:10px 14px;font:700 13px system-ui;cursor:pointer}
.cs-install-arrows button:disabled{opacity:.38;cursor:default}
#cs-install-media-wrap[hidden],#cs-install-video-wrap[hidden],#cs-install-gallery-wrap[hidden]{display:none!important}
@media(max-width:390px){#cs-install-modal{padding:21px 14px}#cs-install-modal h2{font-size:21px}}
  `;
  document.head.appendChild(style);
  const toggle=document.createElement('button');toggle.id='cs-install-toggle';toggle.type='button';toggle.textContent='📲 Salvar aplicativo';
  const overlay=document.createElement('div');overlay.id='cs-install-overlay';overlay.setAttribute('role','presentation');
  overlay.innerHTML=`<section id="cs-install-modal" role="dialog" aria-modal="true" aria-labelledby="cs-install-title">
<button type="button" id="cs-install-close" aria-label="Fechar tutorial">×</button>
<h2 id="cs-install-title">Salve o Clube do Segredo no celular 📲</h2>
<p>Abra pelo ícone na tela inicial, sem precisar procurar o link.</p>
<div id="cs-install-steps"></div>
<div id="cs-install-media-wrap" hidden>
  <div id="cs-install-video-wrap"><p class="cs-install-video-label">▶ Veja o vídeo de instalação (iPhone)</p><video id="cs-install-video" controls playsinline preload="none" aria-label="Vídeo demonstrando como adicionar o Clube do Segredo à tela inicial no iPhone"><source src="/media/instalacao/tutorial-iphone.mp4" type="video/mp4">Seu navegador não suporta vídeo.</video></div>
  <div id="cs-install-gallery-wrap"><p class="cs-install-video-label">📷 Passo a passo com imagens</p><div id="cs-install-gallery" aria-label="Escolha uma imagem do passo a passo"></div>
  <figure id="cs-install-figure"><img id="cs-install-step-image" alt="Imagem do passo a passo da instalação" loading="lazy"><figcaption id="cs-install-step-caption"></figcaption></figure>
  <div class="cs-install-arrows"><button id="cs-install-prev" type="button">← Anterior</button><button id="cs-install-next" type="button">Próxima →</button></div></div>
</div>
<button type="button" id="cs-install-native" hidden>Instalar agora</button>
<p style="font-size:12px;color:#667c70">É necessário ter internet para fazer login e sincronizar o conteúdo.</p>
</section>`;
  document.body.append(toggle,overlay);
  const video=overlay.querySelector('#cs-install-video');
  function close(){overlay.style.display='none';if(!video.paused) video.pause();}
  overlay.querySelector('#cs-install-close').addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  const steps=overlay.querySelector('#cs-install-steps');
  const install=overlay.querySelector('#cs-install-native');
  const media=overlay.querySelector('#cs-install-media-wrap');
  const galleryWrap=overlay.querySelector('#cs-install-gallery-wrap');
  const gallery=overlay.querySelector('#cs-install-gallery');
  const big=overlay.querySelector('#cs-install-step-image');
  const caption=overlay.querySelector('#cs-install-step-caption');
  const prev=overlay.querySelector('#cs-install-prev');
  const next=overlay.querySelector('#cs-install-next');
  const captions=[
    '1. No Safari, abra o menu de compartilhamento.',
    '2. Toque em Compartilhar.',
    '3. Se necessário, toque em Ver Mais.',
    '4. Escolha Adicionar à Tela de Início.',
    '5. Ative Abrir como app web e toque em Adicionar.'
  ];
  let current=0;
  function setSlide(index){
    current=Math.max(0,Math.min(4,index));
    big.src='/media/instalacao/iphone-passo-'+(current+1)+'.jpeg';
    big.alt=captions[current];caption.textContent=captions[current];
    for(const btn of gallery.querySelectorAll('button')) btn.setAttribute('aria-pressed',String(Number(btn.dataset.index)===current));
    prev.disabled=current===0;next.disabled=current===4;
  }
  if(isIOS){
    media.hidden=false;
    galleryWrap.hidden=false;
    for(let i=0;i<5;i++){
      const btn=document.createElement('button');btn.type='button';btn.className='cs-install-thumb';btn.dataset.index=String(i);btn.setAttribute('aria-label','Ver passo '+(i+1));
      const img=document.createElement('img');img.src='/media/instalacao/iphone-passo-'+(i+1)+'.jpeg';img.alt='Passo '+(i+1);img.loading='lazy';
      btn.append(img);btn.addEventListener('click',()=>setSlide(i));gallery.append(btn);
    }
    prev.addEventListener('click',()=>setSlide(current-1));next.addEventListener('click',()=>setSlide(current+1));
    setSlide(0);
  }
  function render(){
    if(isIOS){
      steps.innerHTML='<p><b>iPhone / iPad — Safari</b></p><ol><li>Abra este site no <b>Safari</b> (se necessário).</li><li>Toque no botão <b>Compartilhar</b>.</li><li>Selecione <b>Adicionar à Tela de Início</b> — talvez seja necessário tocar em <b>Ver Mais</b>.</li><li>Ative <b>Abrir como app web</b>, se disponível, e toque em <b>Adicionar</b>.</li><li>Abra o ícone <b>Clube do Segredo</b> na tela inicial.</li></ol>';
      install.hidden=true;
    }else{
      steps.innerHTML='<p><b>Android — Google Chrome</b></p><ol><li>Abra o site no <b>Google Chrome</b>.</li><li>Toque no menu <b>⋮</b> (três pontos).</li><li>Escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.</li><li>Confirme e abra o novo ícone do <b>Clube do Segredo</b>.</li></ol>';
      media.hidden=true;
      install.hidden=!deferredInstall;
    }
  }
  function show(){render();overlay.style.display='flex';}
  toggle.addEventListener('click',show);
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;if(overlay.style.display==='flex')render();});
  install.addEventListener('click',async()=>{if(!deferredInstall)return;const e=deferredInstall;deferredInstall=null;e.prompt();try{await e.userChoice;}catch(_){}close();});
  window.addEventListener('appinstalled',()=>{toggle.remove();close();});
  window.addEventListener('clube:authenticated',event=>{
    toggle.style.display='block';
    if(shownThisSession)return;
    shownThisSession=true;
    const userId=event.detail&&event.detail.id||'user';
    const key='clube:pwa-guide-shown:'+userId;
    try{if(localStorage.getItem(key))return;localStorage.setItem(key,'1');}catch(_){}
    show();
  });
})();
