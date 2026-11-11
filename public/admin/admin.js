'use strict';
const el = id => document.getElementById(id);
const S = {token:null,page:1,total:0,selected:null,search:''};
const config = {url: String(window.APP_SUPABASE_URL||'').replace(/\/$/,''),key:String(window.APP_SUPABASE_ANON_KEY||'')};
function alertUser(msg,type='error') { const a=el('alert');a.textContent=msg;a.className='alert '+type;a.hidden=false;window.scrollTo({top:0,behavior:'smooth'}); }
function clearAlert(){el('alert').hidden=true;}
const safeDate = d => d? new Date(d).toLocaleString('pt-BR'):'—';
const money = c => typeof c==='number' ? (c/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '—';
const planName = p=>p==='premium'?'VIP':p==='basic'?'Básico':'Sem plano';
function node(tag,text,cls=''){const n=document.createElement(tag);n.textContent=text==null?'':String(text);if(cls)n.className=cls;return n;}
function td(text){return node('td',text);}
async function api(path,options={}){
 const r=await fetch('/api/admin-users'+path,{...options,headers:{Authorization:'Bearer '+S.token,...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},cache:'no-store'});
 const body=await r.json().catch(()=>({}));
 if(r.status===401||r.status===403){logout(false);throw Error('Sessão inválida ou conta sem autorização administrativa.');}
 if(!r.ok)throw Error(body.error||`Erro HTTP ${r.status}`);
 return body;
}
function logout(show=true){S.token=null;S.selected=null;sessionStorage.removeItem('clube-admin-token');el('dashboard').hidden=true;el('account').hidden=true;el('login-view').hidden=false;el('detail').hidden=true;if(show)alertUser('Você saiu do painel.','success');}
async function login(event){event.preventDefault();clearAlert();let button=el('login-button');button.disabled=true;
 try{
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||!config.key||config.key.includes('SUA_CHAVE'))throw Error('Configure public/js/config.js com as chaves públicas do Supabase.');
  const r=await fetch(config.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({email:el('email').value.trim(),password:el('password').value})});
  const data=await r.json();if(!r.ok||!data.access_token)throw Error('E-mail ou senha incorretos.');
  S.token=data.access_token;await api('?page=1'); // valida o perfil administrador no servidor
  sessionStorage.setItem('clube-admin-token',S.token);
  el('password').value='';el('login-view').hidden=true;el('dashboard').hidden=false;el('account').hidden=false;el('admin-email').textContent=el('email').value.trim();await load();
 }catch(e){S.token=null;sessionStorage.removeItem('clube-admin-token');alertUser(e.message);}finally{button.disabled=false;}}
async function load(){clearAlert();const tb=el('customer-rows');tb.replaceChildren(node('tr',''));
 try{const data=await api(`?page=${S.page}&search=${encodeURIComponent(S.search)}`);S.total=data.total;el('total').textContent=data.total;el('visible').textContent=data.users.length;el('current-page').textContent=S.page;el('page-label').textContent=`Página ${S.page} de ${Math.max(1,Math.ceil(S.total/50))}`;el('prev').disabled=S.page<=1;el('next').disabled=S.page*50>=S.total;
 tb.replaceChildren();if(!data.users.length){const tr=node('tr');const col=td('Nenhum cliente encontrado.');col.colSpan=5;tr.append(col);tb.append(tr);}else for(const u of data.users){const tr=node('tr');const first=node('td');first.append(node('strong',u.name||'Sem nome'),node('small',u.email));tr.append(first);
 const p=node('td');p.append(node('span',planName(u.plan),'pill '+(u.plan||'')));tr.append(p);
 const active=node('td');active.append(node('span',u.active?'Liberado':'Bloqueado','pill '+(u.active?'basic':'inactive')));tr.append(active,td(safeDate(u.created_at)));
 const action=node('td');const b=node('button','Gerenciar','outline');b.onclick=()=>openDetail(u.id);action.append(b);tr.append(action);tb.append(tr);}}
 catch(e){alertUser(e.message);}}
async function openDetail(id){clearAlert();try{const d=await api('?user='+encodeURIComponent(id));S.selected=d.user;const u=d.user;el('detail').hidden=false;el('detail-title').textContent=u.name||'Sem nome';el('detail-email').textContent=u.email;
 el('detail-status').textContent=`Plano atual: ${planName(u.plan)} · Acesso: ${u.active?'Liberado':'Bloqueado'} · Controle: ${u.admin_premium_override===null?'Automático (Wiapy)':u.admin_premium_override?'VIP manual':'VIP desativado manualmente'}`;
 const orders=el('orders');orders.replaceChildren();if(!d.orders.length){const tr=node('tr'),c=td('Sem compras registradas.');c.colSpan=5;tr.append(c);orders.append(tr);}else for(const x of d.orders){const tr=node('tr');for(const val of [safeDate(x.created_at),planName(x.tier),money(x.amount_cents),x.status,x.payment_id])tr.append(td(val));orders.append(tr);}
 const activity=el('activity');activity.replaceChildren();if(!d.activity.length)activity.append(node('div','Nenhum evento de atividade registrado.'));else for(const x of d.activity)activity.append(node('div',`${safeDate(x.created_at)} — ${x.evento||'Evento'}`));
 el('detail').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){alertUser(e.message);}}
async function premium(override){if(!S.selected)return;const name=S.selected.email;const msg=override===true?'ativar VIP':override===false?'desativar VIP':'retornar o plano ao automático (Wiapy)';if(!confirm(`Confirma ${msg} para ${name}?`))return;
 try{await api('',{method:'POST',body:JSON.stringify({action:'premium',userId:S.selected.id,override})});alertUser('Permissão atualizada com sucesso.','success');await Promise.all([load(),openDetail(S.selected.id)]);}catch(e){alertUser(e.message);}}
async function reset(){if(!S.selected)return;if(!confirm(`Enviar e-mail de recuperação de senha para ${S.selected.email}?`))return;
 try{await api('',{method:'POST',body:JSON.stringify({action:'reset',userId:S.selected.id})});alertUser('Solicitação enviada ao Supabase. Confira o e-mail do comprador.','success');}catch(e){alertUser(e.message);}}
window.addEventListener('DOMContentLoaded',async()=>{
 el('login-form').onsubmit=login;el('logout').onclick=()=>logout();el('reload').onclick=()=>load();el('close-detail').onclick=()=>{el('detail').hidden=true;S.selected=null;};
 el('search-form').onsubmit=e=>{e.preventDefault();S.page=1;S.search=el('search').value.trim();load();};el('prev').onclick=()=>{if(S.page>1){S.page--;load();}};el('next').onclick=()=>{if(S.page*50<S.total){S.page++;load();}};
 el('enable-vip').onclick=()=>premium(true);el('disable-vip').onclick=()=>premium(false);el('auto-vip').onclick=()=>premium(null);el('reset-password').onclick=reset;
 const token=sessionStorage.getItem('clube-admin-token');if(token){S.token=token;try{await api('?page=1');el('login-view').hidden=true;el('dashboard').hidden=false;el('account').hidden=false;await load();}catch{logout(false);}}
});
