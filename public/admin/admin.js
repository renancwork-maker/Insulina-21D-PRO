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
function percent(part,total){return total>0?(100*part/total):0;}
const deviceLabel={ios:'iOS / iPhone',android:'Android',desktop:'PC / Notebook',other:'Outros',unknown:'Não informado'};
function renderBars(container,entries,denominator,kind){
 const wrap=el(container);wrap.replaceChildren();
 for(const [key,count] of entries){
  const total=Number(count)||0,pct=percent(total,denominator);
  const item=node('div');const top=node('div','','buyer-bar-top');
  top.append(node('span',kind==='device'?deviceLabel[key]||key:key),node('strong',`${pct.toFixed(1).replace('.',',')}% · ${total}`));
  const track=node('div','','buyer-track'),bar=node('span','','buyer-fill'+(key==='unknown'?' is-unknown':'')+(kind==='age'?' is-age':''));bar.style.width=pct+'%';
  track.append(bar);item.append(top,track);wrap.append(item);
 }
}
async function loadDemographics(){
 try{
  const {statistics}=await api('?view=demographics');
  const d=statistics||{},n=Number(d.total)||0,a=Number(d.age_reported)||0,dev=d.device||{},age=d.age||{};
  el('buyers-total').textContent=n;el('buyers-age-informed').textContent=`${a} (${percent(a,n).toFixed(1).replace('.',',')}%)`;
  const identified=Math.max(0,n-(Number(dev.unknown)||0));el('buyers-device-informed').textContent=`${identified} (${percent(identified,n).toFixed(1).replace('.',',')}%)`;
  renderBars('device-bars',['ios','android','desktop','other','unknown'].map(k=>[k,dev[k]||0]),n,'device');
  renderBars('age-bars',['18-24','25-34','35-44','45-54','55-64','65+'].map(k=>[k,age[k]||0]),a,'age');
  el('analytics-note').textContent=`Base: ${n} comprador(es) com pagamento aprovado. ${Math.max(0,n-a)} ainda não informaram a idade. O dispositivo representa o primeiro acesso ao aplicativo, não o sistema usado no checkout.`;
 }catch(e){el('analytics-note').textContent='Não foi possível carregar os indicadores. Execute o SQL 06_PERFIL_COMPRADORES.sql e confira os logs de admin-users. '+e.message;}
}
function isOnline(lastSeen){
 const t=lastSeen?Date.parse(lastSeen):NaN;
 return Number.isFinite(t) && Date.now()-t<=120000 && Date.now()>=t-5000;
}
async function loadAppActivity(){
 try{
  const {statistics}=await api('?view=app_activity');
  const d=statistics||{},access=Number(d.access_granted)||0,ever=Number(d.ever_opened)||0,pwa=Number(d.pwa_detected)||0;
  el('app-access-granted').textContent=access;
  el('app-ever-opened').textContent=ever;
  el('app-online-now').textContent=Number(d.online_now)||0;
  el('app-active-24h').textContent=Number(d.active_24h)||0;
  el('app-pwa-detected').textContent=pwa;
  el('app-ever-pct').textContent=percent(ever,access).toFixed(1).replace('.',',')+'% das contas liberadas';
  el('app-pwa-pct').textContent=percent(pwa,access).toFixed(1).replace('.',',')+'% das contas liberadas';
  el('app-activity-note').textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR')+'. Online agora = última atividade nos últimos 2 minutos. Último acesso e instalação são individuais por conta.';
 }catch(e){
  el('app-activity-note').textContent='Não foi possível carregar o uso do app. Execute 07_ATIVIDADE_APP.sql e verifique os logs da função admin-users: '+e.message;
 }
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
async function load(){clearAlert();loadDemographics();loadAppActivity();const tb=el('customer-rows');tb.replaceChildren(node('tr',''));
 try{const data=await api(`?page=${S.page}&search=${encodeURIComponent(S.search)}`);S.total=data.total;el('total').textContent=data.total;el('visible').textContent=data.users.length;el('current-page').textContent=S.page;el('page-label').textContent=`Página ${S.page} de ${Math.max(1,Math.ceil(S.total/50))}`;el('prev').disabled=S.page<=1;el('next').disabled=S.page*50>=S.total;
 tb.replaceChildren();if(!data.users.length){const tr=node('tr');const col=td('Nenhum cliente encontrado.');col.colSpan=7;tr.append(col);tb.append(tr);}else for(const u of data.users){const tr=node('tr');const first=node('td');first.append(node('strong',u.name||'Sem nome'),node('small',u.email));tr.append(first);
 const p=node('td');p.append(node('span',planName(u.plan),'pill '+(u.plan||'')));tr.append(p);
 const active=node('td');active.append(node('span',u.active?'Liberado':'Bloqueado','pill '+(u.active?'basic':'inactive')));tr.append(active,td(safeDate(u.created_at)));
 const usage=u.appActivity||{};
 const last=usage.last_seen_at;
 const activityCell=node('td');
 activityCell.append(node('span',usage.last_open_at?safeDate(usage.last_open_at):'Ainda não entrou'));
 if(isOnline(last))activityCell.append(node('small','● Ativo agora'));
 tr.append(activityCell,td(usage.pwa_installed_at?'Detectado':'Não detectado'));
 const action=node('td');const b=node('button','Gerenciar','outline');b.onclick=()=>openDetail(u.id);action.append(b);tr.append(action);tb.append(tr);}}
 catch(e){alertUser(e.message);}}
async function openDetail(id){clearAlert();try{const d=await api('?user='+encodeURIComponent(id));S.selected=d.user;const u=d.user;el('detail').hidden=false;el('detail-title').textContent=u.name||'Sem nome';el('detail-email').textContent=u.email;
 el('detail-status').textContent=`Plano atual: ${planName(u.plan)} · Acesso: ${u.active?'Liberado':'Bloqueado'} · Controle: ${u.admin_premium_override===null?'Automático (Wiapy)':u.admin_premium_override?'VIP manual':'VIP desativado manualmente'}`;
 const dem=d.demographics;el('detail-demographics').textContent='Primeiro acesso: '+(dem?.first_app_os?deviceLabel[dem.first_app_os]||dem.first_app_os:'Não identificado')+' · Idade: '+(dem?.age?dem.age+' anos':dem?.age_skipped?'Preferiu não informar':'Não informada');
 const usage=d.appActivity||{};
 el('detail-app-activity').textContent='App: '+(usage.first_open_at?'Primeiro acesso '+safeDate(usage.first_open_at):'Nunca entrou')+' · Última entrada: '+safeDate(usage.last_open_at)+' · Última atividade: '+safeDate(usage.last_seen_at)+' · '+(isOnline(usage.last_seen_at)?'Ativo agora (estimativa)':'Offline ou inativo')+' · PWA: '+(usage.pwa_installed_at?'Detectado em '+safeDate(usage.pwa_installed_at):'Não detectado')+' · Aberturas registradas: '+(Number(usage.open_count)||0);

 const orders=el('orders');orders.replaceChildren();if(!d.orders.length){const tr=node('tr'),c=td('Sem compras registradas.');c.colSpan=5;tr.append(c);orders.append(tr);}else for(const x of d.orders){const tr=node('tr');for(const val of [safeDate(x.created_at),planName(x.tier),money(x.amount_cents),x.status,x.payment_id])tr.append(td(val));orders.append(tr);}
 const activity=el('activity');activity.replaceChildren();if(!d.activity.length)activity.append(node('div','Nenhum evento de atividade registrado.'));else for(const x of d.activity)activity.append(node('div',`${safeDate(x.created_at)} — ${x.evento||'Evento'}`));
 el('detail').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){alertUser(e.message);}}
async function premium(override){if(!S.selected)return;const name=S.selected.email;const msg=override===true?'ativar VIP':override===false?'desativar VIP':'retornar o plano ao automático (Wiapy)';if(!confirm(`Confirma ${msg} para ${name}?`))return;
 try{await api('',{method:'POST',body:JSON.stringify({action:'premium',userId:S.selected.id,override})});alertUser('Permissão atualizada com sucesso.','success');await Promise.all([load(),openDetail(S.selected.id)]);}catch(e){alertUser(e.message);}}
async function reset(){if(!S.selected)return;if(!confirm(`Enviar e-mail de recuperação de senha para ${S.selected.email}?`))return;
 try{await api('',{method:'POST',body:JSON.stringify({action:'reset',userId:S.selected.id})});alertUser('Solicitação enviada ao Supabase. Confira o e-mail do comprador.','success');}catch(e){alertUser(e.message);}}
async function addManualCustomer(event){
 event.preventDefault();clearAlert();
 const email=el('manual-email').value.trim().toLowerCase();
 const plan=el('manual-plan').value;
 if(!email||!['basic','premium'].includes(plan))return;
 if(!confirm(`Liberar acesso ${plan==='premium'?'Premium / VIP':'Básico / Tradicional'} para ${email}? Se já existir, o plano atual será atualizado.`))return;
 const button=el('manual-save');button.disabled=true;button.textContent='Cadastrando…';
 el('manual-result').textContent='Criando ou atualizando acesso…';
 try{
  const result=await api('',{method:'POST',body:JSON.stringify({action:'create_manual',email,plan})});
  const msg=result.emailSent?'Acesso liberado e link de senha enviado por e-mail. Oriente a conferir também o spam.':'Acesso liberado, mas houve falha no envio do e-mail. Localize o cliente e use Enviar link para criar/redefinir senha.';
  el('manual-result').textContent=msg;
  alertUser(msg,result.emailSent?'success':'error');
  el('manual-email').value='';S.search=email;S.page=1;el('search').value=email;
  await load();
 }catch(e){el('manual-result').textContent='Não foi possível cadastrar: '+e.message;alertUser(e.message);}
 finally{button.disabled=false;button.textContent='Liberar acesso e enviar link';}
}
window.addEventListener('DOMContentLoaded',async()=>{
 el('manual-customer-form').onsubmit=addManualCustomer;
 el('app-activity-reload').onclick=loadAppActivity;
 setInterval(()=>{if(S.token&&!el('dashboard').hidden&&document.visibilityState==='visible')loadAppActivity()},30000);
 el('analytics-reload').onclick=loadDemographics;
 el('login-form').onsubmit=login;el('logout').onclick=()=>logout();el('reload').onclick=()=>load();el('close-detail').onclick=()=>{el('detail').hidden=true;S.selected=null;};
 el('search-form').onsubmit=e=>{e.preventDefault();S.page=1;S.search=el('search').value.trim();load();};el('prev').onclick=()=>{if(S.page>1){S.page--;load();}};el('next').onclick=()=>{if(S.page*50<S.total){S.page++;load();}};
 el('enable-vip').onclick=()=>premium(true);el('disable-vip').onclick=()=>premium(false);el('auto-vip').onclick=()=>premium(null);el('reset-password').onclick=reset;
 const token=sessionStorage.getItem('clube-admin-token');if(token){S.token=token;try{await api('?page=1');el('login-view').hidden=true;el('dashboard').hidden=false;el('account').hidden=false;await load();}catch{logout(false);}}
});
