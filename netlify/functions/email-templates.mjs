const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const firstName = value => String(value || '').trim().split(/\s+/)[0] || 'tudo bem';

function layout(title, body) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f5f3eb;color:#173d2f;font-family:Arial,Helvetica,sans-serif"><div style="margin:auto;max-width:540px;padding:28px;background:#fff;border-radius:18px"><p style="font-size:12px;letter-spacing:1.8px;color:#ae8137;font-weight:700">CLUBE DO SEGREDO</p><h1 style="font-size:23px;line-height:1.25">${escapeHTML(title)}</h1>${body}<hr style="border:0;border-top:1px solid #e6e8df;margin:24px 0"><p style="font-size:13px;color:#6d746f">Equipe Clube do Segredo</p></div></body></html>`;
}
const button = (url, label) => `<p style="text-align:center;margin:26px 0"><a href="${escapeHTML(url)}" style="display:inline-block;background:#1b5e43;color:#fff;padding:15px 24px;border-radius:9px;text-decoration:none;font-size:16px;font-weight:bold">${escapeHTML(label)}</a></p>`;

/** E-mail transacional após pagamento. NUNCA expõe senha, mesmo em um upgrade. */
export function buildEmail({tier,name,email,appUrl,setupUrl=null}) {
  const vip=tier==='premium';
  const title=vip?'Seu Plano VIP está liberado!':'Seu acesso ao Segredo da Insulina está liberado!';
  const intro=vip
    ?'Seu upgrade foi aprovado e seu Plano VIP já está disponível no aplicativo.'
    :'Seu pagamento foi aprovado! Preparamos suas receitas e sua rotina para os próximos 21 dias.';
  const greeting=`Olá, ${firstName(name)}!`;
  const instructions=setupUrl
    ?'Toque no botão abaixo e crie uma senha pessoal. Depois, entre no aplicativo com seu e-mail e a senha que você escolheu.'
    :'Seu acesso já está liberado. Entre com seu e-mail e a senha pessoal que você já criou. Caso tenha esquecido, use “Esqueci minha senha” na tela de login.';
  const link=setupUrl||appUrl;
  const subject=title;
  const text=`${greeting}\n\n${intro}\n\n${instructions}\n\nE-mail para login: ${email}\n\n${setupUrl?'CRIE SUA SENHA':'ACESSE O APLICATIVO'}: ${link}\n\n${setupUrl?'O link é individual, válido por tempo limitado e pode ser utilizado uma vez. Nunca compartilhe esse link.\n\n':''}Equipe Clube do Segredo`;
  const html=layout(title,`<p>${escapeHTML(greeting)}</p><p>${escapeHTML(intro)}</p><p>${escapeHTML(instructions)}</p><div style="background:#f6f3eb;padding:14px 18px;border-radius:10px"><strong>E-mail de acesso:</strong> ${escapeHTML(email)}</div>${button(link,setupUrl?'CRIAR MINHA SENHA':'ABRIR O APLICATIVO')}${setupUrl?'<p style="font-size:13px;color:#5b665f">Este link é individual, de uso único e expira automaticamente. Se ele expirar, toque em “Esqueci minha senha” no aplicativo para solicitar outro.</p>':''}<p style="font-size:13px;color:#5b665f">Se precisar de ajuda, utilize nosso canal de suporte.</p>`);
  return {subject,text,html};
}

export function buildNoLoginReminderEmail({name,email,appUrl,setupUrl}) {
  const subject='Sua rotina de 21 dias está pronta — vamos começar? 💚';
  const intro='Nós preparamos tudo para você no aplicativo: suas receitas, orientações e uma rotina organizada para os seus 21 dias.';
  const action=setupUrl
    ?'Vimos que você ainda não entrou. Toque no botão para criar sua senha pessoal e começar.'
    :'Vimos que você ainda não entrou. Abra o aplicativo com a senha pessoal que você definiu.';
  const link=setupUrl||appUrl;
  const text=`Olá, ${firstName(name)}!\n\n${intro}\n\n${action}\n\nE-mail de acesso: ${email}\n${setupUrl?'Criar senha':'Entrar no aplicativo'}: ${link}\n\nSe você já acessou, desconsidere este lembrete.\n\nEquipe Clube do Segredo`;
  const html=layout('Sua rotina de 21 dias está pronta 💚',`<p>Olá, ${escapeHTML(firstName(name))}!</p><p>${escapeHTML(intro)}</p><p>${escapeHTML(action)}</p><div style="background:#f6f3eb;padding:14px 18px;border-radius:10px"><strong>E-mail de acesso:</strong> ${escapeHTML(email)}</div>${button(link,setupUrl?'CRIAR MINHA SENHA':'ACESSAR MEU APLICATIVO')}<p style="font-size:13px;color:#5b665f">Se o link expirar, você pode solicitar outro em “Esqueci minha senha”. Se já acessou, desconsidere esta mensagem.</p>`);
  return {subject,html,text};
}

export function buildPasswordResetEmail({email,setupUrl,name=''}) {
  const subject='Crie sua senha de acesso — Clube do Segredo';
  const title='Escolha sua senha para entrar no aplicativo';
  const text=`Olá${name?', '+firstName(name):''}!\n\nRecebemos uma solicitação para criar ou redefinir a senha da conta ${email}.\n\nClique neste link individual: ${setupUrl}\n\nSe você não solicitou, ignore esta mensagem. O link é válido por tempo limitado.\n\nEquipe Clube do Segredo`;
  const html=layout(title,`<p>Recebemos uma solicitação para criar ou redefinir a senha de acesso.</p><p><strong>E-mail:</strong> ${escapeHTML(email)}</p>${button(setupUrl,'ESCOLHER MINHA SENHA')}<p style="font-size:13px;color:#5b665f">Se não foi você, ignore esta mensagem. O link é individual, de uso único e expira automaticamente.</p>`);
  return {subject,html,text};
}
