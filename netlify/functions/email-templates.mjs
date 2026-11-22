// Mensagens exclusivamente transacionais. Nao incluir senha, pixels ou links rastreados.
// A autenticacao SPF/DKIM/DMARC depende dos registros DNS do remetente na Resend.
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const firstName = value => String(value || '').trim().split(/\s+/)[0] || 'cliente';
const APP_NAME = 'Segredo da Insulina - 21 Dias';
const SUPPORT_PHONE = '(11) 93238-3351';

function layout(title, content) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f7f8f6;padding:18px 10px;font-family:Arial,Helvetica,sans-serif;color:#243b32"><main style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e9e5;border-radius:10px;padding:24px"><p style="font-size:13px;font-weight:bold;color:#296349">${APP_NAME}</p><h1 style="font-size:22px;line-height:1.3;margin:20px 0">${escapeHTML(title)}</h1>${content}<hr style="border:0;border-top:1px solid #e5e9e5;margin:24px 0"><p style="font-size:13px;color:#59675f">Precisa de ajuda? Suporte: ${SUPPORT_PHONE}</p><p style="font-size:13px;color:#59675f">Equipe Clube do Segredo</p></main></body></html>`;
}
function cta(url,label) {
  return `<p style="margin:22px 0"><a href="${escapeHTML(url)}" style="display:inline-block;background:#20583e;color:white;text-decoration:none;padding:14px 18px;border-radius:7px;font-size:16px;font-weight:bold">${escapeHTML(label)}</a></p>`;
}
const loginLabel = email => `<p><strong>E-mail de acesso:</strong> ${escapeHTML(email)}</p>`;
const footerText = `Se precisar de ajuda, entre em contato pelo telefone ${SUPPORT_PHONE}.\nEquipe Clube do Segredo`;

/** Compra aprovada ou upgrade. Link individual quando a conta exige definicao de senha. */
export function buildEmail({tier,name,email,appUrl,setupUrl=null}) {
  const premium = tier === 'premium';
  const subject = setupUrl ? 'Crie sua senha para acessar o Segredo da Insulina' : (premium ? 'Seu acesso VIP ao Segredo da Insulina' : 'Seu acesso ao Segredo da Insulina');
  const greeting = `Olá, ${firstName(name)}!`;
  const intro = premium ? 'Seu pagamento foi confirmado e seu plano VIP está disponível no aplicativo.' : 'Seu pagamento foi confirmado. Seu conteúdo de 21 dias está disponível no aplicativo.';
  const instruction = setupUrl ? 'Para começar, use o botão abaixo para criar sua senha pessoal. Depois, acesse o aplicativo com seu e-mail e a senha escolhida.' : 'Para entrar, utilize o e-mail da compra e sua senha pessoal. Se não lembrar da senha, use a opção Esqueci minha senha na tela de login.';
  const label = setupUrl ? 'Criar minha senha' : 'Acessar aplicativo';
  const link = setupUrl || appUrl;
  const text = `${greeting}\n\n${intro}\n\n${instruction}\n\nE-mail de acesso: ${email}\n\n${label}: ${link}\n\n${setupUrl?'Este link é individual e expira. Se necessário, solicite outro em Esqueci minha senha.\n\n':''}${footerText}`;
  const html = layout('Seu acesso está disponível', `<p>${escapeHTML(greeting)}</p><p>${escapeHTML(intro)}</p><p>${escapeHTML(instruction)}</p>${loginLabel(email)}${cta(link,label)}${setupUrl?'<p style="font-size:13px">O link é individual e expira. Se necessário, solicite outro em Esqueci minha senha.</p>':''}`);
  return {subject,text,html};
}

export function buildNoLoginReminderEmail({name,email,appUrl,setupUrl}) {
  const subject='Seu acesso ao Segredo da Insulina está disponível';
  const greeting=`Olá, ${firstName(name)}!`;
  const intro='Sua rotina e suas receitas dos 21 dias já estão disponíveis no aplicativo. Percebemos que você ainda não entrou.';
  const instruction=setupUrl?'Crie sua senha pessoal usando o link abaixo para começar.':'Entre com o e-mail da compra e sua senha pessoal. Se necessário, solicite uma nova senha na tela de login.';
  const link=setupUrl||appUrl;
  const label=setupUrl?'Criar minha senha':'Acessar aplicativo';
  const text=`${greeting}\n\n${intro}\n\n${instruction}\n\nE-mail de acesso: ${email}\n\n${label}: ${link}\n\nSe você já acessou o aplicativo, pode desconsiderar esta mensagem.\n\n${footerText}`;
  const html=layout('Seu acesso está disponível',`<p>${escapeHTML(greeting)}</p><p>${escapeHTML(intro)}</p><p>${escapeHTML(instruction)}</p>${loginLabel(email)}${cta(link,label)}<p style="font-size:13px">Se você já acessou o aplicativo, pode desconsiderar esta mensagem.</p>`);
  return {subject,html,text};
}

export function buildPasswordResetEmail({email,setupUrl,name=''}) {
  const subject='Link para criar sua senha - Segredo da Insulina';
  const greeting=`Olá${name?', '+firstName(name):''}!`;
  const text=`${greeting}\n\nRecebemos uma solicitação para criar ou redefinir a senha de acesso ao ${APP_NAME}.\n\nE-mail de acesso: ${email}\n\nCriar minha senha: ${setupUrl}\n\nSe não foi você, ignore este e-mail. O link é individual e expira.\n\n${footerText}`;
  const html=layout('Crie sua senha pessoal',`<p>${escapeHTML(greeting)}</p><p>Recebemos uma solicitação para criar ou redefinir sua senha de acesso.</p>${loginLabel(email)}${cta(setupUrl,'Criar minha senha')}<p style="font-size:13px">Se não foi você, ignore esta mensagem. O link é individual e expira.</p>`);
  return {subject,html,text};
}
