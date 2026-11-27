(()=>{'use strict';
const VSL='https://insulina21d.vercel.app/oferta';
let dialog=null,seq=0,known=null;
const seen=new Set();
async function track(event){try{const simple=window.__clubeSimpleMode===true;const token=simple?null:(await window.__clubeSupabase?.auth?.getSession?.())?.data?.session?.access_token;await fetch("/api/vip-events",{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify({event}),keepalive:true});}catch{}}
function view(root){const card=root?.querySelector(".p-vip-promo");if(!card||card.hidden||seen.has("offer_view"))return;const record=()=>{if(card.isConnected&&!card.hidden&&!seen.has("offer_view")){seen.add("offer_view");track("offer_view");}};if(window.IntersectionObserver){const io=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting)){record();io.disconnect();}else if(!card.isConnected)io.disconnect();},{threshold:.2});io.observe(card);setTimeout(()=>io.disconnect(),120000);}else record();}
function close(){seq++;dialog?.remove();dialog=null;}
function button(parent,text,fn,secondary=false){const b=document.createElement('button');b.type='button';b.textContent=text;if(secondary)b.className='secondary';b.onclick=fn;parent.append(b);return b;}
function p(parent,text){const e=document.createElement('p');e.textContent=text;parent.append(e);return e;}
async function status(){const simple=window.__clubeSimpleMode===true;const token=simple?null:(await window.__clubeSupabase?.auth?.getSession?.())?.data?.session?.access_token;const res=await fetch('/api/vip-support',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},cache:'no-store'});if(!res.ok)throw Error('check');return res.json();}
function update(root,data){if(!root?.isConnected)return;const card=root.querySelector('.p-vip-promo');const label=root.querySelector('.p-vip-float-label');if(card)card.hidden=data?.vip===true||data?.vip_pending===true;if(label)label.textContent=data?.vip===true||data?.vip_pending===true?'Meu WhatsApp VIP':'Conheça o VIP';}
window.clubeMountVip=(root)=>{update(root,known);status().then(d=>{known=d;update(root,d);view(root)}).catch(()=>{view(root)});};
function verifyVip(body){
 if(window.__clubeSimpleMode!==true){location.assign('/?privado=1&vip=1');return;}
 body.replaceChildren();p(body,'Confirme o e-mail da compra uma vez, sem sair do aplicativo.');
 const form=document.createElement('form');body.append(form);const email=document.createElement('input');email.type='email';email.required=true;email.placeholder='E-mail da compra';email.autocomplete='email';email.setAttribute('aria-label','E-mail da compra');form.append(email);
 const code=document.createElement('input');code.type='text';code.inputMode='numeric';code.autocomplete='one-time-code';code.placeholder='Código recebido por e-mail';code.setAttribute('aria-label','Código recebido por e-mail');code.maxLength=10;code.hidden=true;form.append(code);
 const submit=document.createElement('button');submit.type='submit';submit.textContent='Enviar código';form.append(submit);const note=p(form,'');note.setAttribute('role','status');let sent=false,busy=false;
 const retry=button(form,'Alterar e-mail / reenviar código',()=>{sent=false;code.hidden=true;code.required=false;code.value='';email.readOnly=false;submit.textContent='Enviar código';note.textContent='';email.focus();},true);retry.hidden=true;
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;submit.disabled=retry.disabled=true;note.textContent='';try{
 const res=await fetch('/api/purchase-direct-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:sent?'verify':'send',identifier:email.value.trim(),...(sent?{code:code.value.trim()}:{})}),cache:'no-store'});
 if(!res.ok){note.textContent=sent?'Código incorreto, expirado ou indisponível. Confira e tente novamente.':'Não foi possível enviar o código. Tente novamente.';return;}
 if(!sent){sent=true;code.hidden=false;code.required=true;retry.hidden=false;email.readOnly=true;submit.textContent='Confirmar e abrir WhatsApp';note.textContent='Se a compra for localizada, o código chegará ao e-mail. Confira também o spam.';code.focus();return;}
 const d=await status();if(d.vip===true&&/^https:\/\/wa\.me\/\d+$/.test(d.whatsapp||'')){known=d;update(document.getElementById('protocol-card'),d);close();location.assign(d.whatsapp);return;}
 note.textContent='O VIP não foi confirmado para este acesso. Use o mesmo e-mail com que entrou no app e comprou o VIP.';
 }catch{note.textContent='Não foi possível concluir. Confira a conexão e tente novamente.';}finally{busy=false;submit.disabled=retry.disabled=false;}};email.focus();
}
async function open(){close();const current=++seq;const wrap=document.createElement('div');wrap.id='vip-support-overlay';wrap.style.cssText='position:fixed;inset:0;z-index:2147483500;background:#102e24bb;display:grid;place-items:center;padding:14px;overflow:auto';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');wrap.setAttribute('aria-label','Acompanhamento VIP');dialog=wrap;
 const panel=document.createElement('section');panel.className='protocol-ui vip-modal';panel.style.cssText='background:#fffdf5;border-radius:20px;padding:24px;width:min(100%,450px);max-height:90vh;overflow:auto;box-sizing:border-box;color:#173d2c';wrap.append(panel);document.body.append(wrap);const title=document.createElement('h1');title.textContent='Acompanhamento VIP';panel.append(title);const body=document.createElement('div');panel.append(body);p(body,'Consultando seu acesso…');button(panel,'Agora não · voltar ao app',close,true);
 try{const data=await status();if(current!==seq)return;known=data;update(document.getElementById('protocol-card'),data);body.replaceChildren();
 if(data.vip===true&&/^https:\/\/wa\.me\/\d+$/.test(data.whatsapp||'')){close();location.assign(data.whatsapp);return;}
 if(data.vip_pending===true){title.textContent='Seu WhatsApp VIP';p(body,'Sua compra VIP foi localizada. Confirme seu e-mail para liberar o número exclusivo.');button(body,'Confirmar e-mail e abrir WhatsApp',()=>verifyVip(body));return;}
 track('offer_click');track('presentation_open');title.textContent='Conheça a Doutora do Segredo';p(body,'Sua assistente virtual pelo WhatsApp para ajudar a organizar a rotina dos 21 dias.');const list=document.createElement('ul');list.className='vip-benefits';for(const text of ['Ajuda com dúvidas sobre receitas e alimentação','Dicas para organizar festas, viagens e imprevistos','21 dias de acompanhamento virtual','Protocolos extras com acesso permanente']){const li=document.createElement('li');li.textContent=text;list.append(li);}body.append(list);
 const price=document.createElement('h2');price.className='vip-price';price.textContent='R$ 67,00';body.append(price);p(body,'Pagamento único • Sem mensalidade');
 if(/^https:\/\/pay\.wiapy\.com\//.test(data.checkout_url||'')){const a=document.createElement('a');a.className='p-btn vip-buy';a.href=data.checkout_url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='QUERO LIBERAR MEU VIP';a.addEventListener('click',()=>track('checkout_click'));body.append(a);}else p(body,'Compra temporariamente indisponível. Contate suporte@digitalco.site.');
 button(body,'▶ Assistir ao vídeo explicativo',()=>{track('video_click');window.open(VSL,'_blank','noopener,noreferrer');},true);p(body,'7 dias de garantia. Assistente virtual, não substitui atendimento médico.');
 if(data.verification_required){p(body,'Já comprou o VIP? Confirme seu e-mail uma vez para liberar o WhatsApp exclusivo.');button(body,'Já comprei · acessar meu WhatsApp',()=>verifyVip(body),true);}else{button(body,'Já comprei · conferir pagamento',open,true);}
 }catch{if(current!==seq)return;body.replaceChildren();p(body,'Não foi possível confirmar o acesso VIP agora. Tente novamente.');button(body,'Tentar novamente',open);}}
window.clubeOpenVip=open;
window.addEventListener('clube:protocolo-seguro',()=>{const u=new URL(location.href);if(u.searchParams.get('vip')==='1'){u.searchParams.delete('vip');history.replaceState(null,'',u.pathname+u.search+u.hash);open();}});
window.addEventListener('pagehide',close);
})();
