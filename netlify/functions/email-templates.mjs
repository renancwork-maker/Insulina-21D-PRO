// Somente e-mails de instruções para login por código (OTP).
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function buildAccessInstructionsEmail({email,name='',appUrl,reason='manual'}) {
 const origin=new URL(appUrl).origin;
 if(!origin.startsWith('https://'))throw Error('invalid_app_url');
 const app=origin+'/';
 const first=String(name||'').trim().split(/\s+/)[0]||'cliente';
 const intro=reason==='purchase'?'Seu pagamento foi aprovado e seu acesso está disponível.':reason==='reminder'?'Sua rotina de 21 dias já está disponível. Para começar, siga as instruções:':'Seu acesso ao aplicativo está liberado.';
 const subject=reason==='purchase'?'Compra confirmada — como acessar Segredo da Insulina':reason==='reminder'?'Seu acesso ao Segredo da Insulina está disponível':'Instruções de acesso — Segredo da Insulina';
 const steps=['Abra o aplicativo pelo botão ou endereço abaixo.','Informe o e-mail utilizado na compra.','Clique em Receber código de acesso.','Confira a caixa de entrada e principalmente a pasta Spam/Lixo eletrônico.','Digite o código de 6 números recebido para entrar. Não precisa criar senha.'];
 const text=`Olá, ${first}!\n\n${intro}\n\n${steps.map((x,i)=>(i+1)+'. '+x).join('\n')}\n\nSeu e-mail: ${email}\nAplicativo: ${app}\n\nSuporte: (11) 93238-3351\nEquipe Clube do Segredo`;
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#f4f7f4;font-family:Arial,sans-serif;color:#193d31;margin:0;padding:20px 10px"><main style="max-width:520px;margin:auto;background:white;border:1px solid #dce8de;border-radius:14px;padding:24px"><p style="font-weight:bold;font-size:13px">Segredo da Insulina — 21 Dias</p><h1 style="font-size:22px">Seu acesso ao aplicativo</h1><p>Olá, ${esc(first)}!</p><p>${esc(intro)}</p><ol style="line-height:1.7;padding-left:22px">${steps.map(x=>'<li>'+esc(x)+'</li>').join('')}</ol><p style="padding:12px;background:#fff3d3;border-radius:9px"><b>IMPORTANTE: confira a pasta Spam/Lixo eletrônico</b> para localizar o código.</p><p><b>E-mail cadastrado:</b> ${esc(email)}</p><p><a href="${esc(app)}" style="display:inline-block;background:#176344;color:#fff;padding:14px 20px;text-decoration:none;border-radius:8px;font-weight:bold">Acessar aplicativo</a></p><p style="font-size:13px">Endereço: <a href="${esc(app)}">${esc(app)}</a></p><hr style="border:0;border-top:1px solid #eee"><p style="font-size:13px">Suporte WhatsApp: (11) 93238-3351<br>Equipe Clube do Segredo</p></main></body></html>`;
 return {subject,text,html};
}
export function buildEmail({name,email,appUrl}){return buildAccessInstructionsEmail({name,email,appUrl,reason:'purchase'});}
export function buildNoLoginReminderEmail({name,email,appUrl}){return buildAccessInstructionsEmail({name,email,appUrl,reason:'reminder'});}
