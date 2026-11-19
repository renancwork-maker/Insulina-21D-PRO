const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function buildEmail({ tier, name, email, appUrl, initialPassword }) {
  const vip = tier === 'premium';
  const safeName = escapeHTML((name || '').trim().split(' ')[0] || 'Olá');
  const safeAppUrl = escapeHTML(appUrl);
  const safeEmail = escapeHTML(email);
  const safePassword = escapeHTML(initialPassword);
  const subject = vip ? 'Seu Plano VIP do Clube do Segredo foi liberado!' : 'Seu acesso ao Segredo da Insulina está liberado!';
  const intro = vip
    ? 'Seu upgrade foi aprovado! Sua conta agora tem acesso ao Plano VIP, além dos conteúdos do plano original.'
    : 'Seu pagamento foi confirmado! O acesso ao plano Básico do Segredo da Insulina de 21 Dias está disponível.';
  const passwordNote = vip
    ? 'Sua senha atual continua a mesma. Se ainda não a alterou desde a primeira compra, a senha inicial é:'
    : 'Para o primeiro acesso, utilize a senha provisória:';
  const credentialsText = vip
    ? `Login: ${email}\nSenha: continue usando sua senha atual. Se ainda não alterou, sua senha provisória é ${initialPassword}.`
    : `Login: ${email}\nSenha: ${initialPassword}`;
  const text = `${name ? name.split(' ')[0] + ', ' : ''}${intro}\n\n${credentialsText}\nPlano: ${vip ? 'VIP — upgrade R$ 67' : 'Básico — R$ 37'}\n\nAcessar o aplicativo: ${appUrl}\n\nPor segurança, altere a senha inicial no primeiro acesso. Se já criou sua senha pessoal, continue usando-a. Não responda este e-mail com sua senha.\n\nEquipe Clube do Segredo`;
  const credentialsHTML = vip
    ? `<p style="margin:0 0 7px"><strong>Login:</strong> ${safeEmail}</p><p style="margin:0 0 7px"><strong>Senha:</strong> continue usando sua senha atual.</p><p style="margin:0 0 14px;font-size:13px;color:#555">Se ainda não a alterou, sua senha provisória é <strong>${safePassword}</strong>.</p>`
    : `<p style="margin:0 0 7px"><strong>Login:</strong> ${safeEmail}</p><p style="margin:0 0 14px"><strong>Senha:</strong> ${safePassword}</p>`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body style="background:#f6f3eb;color:#173d2f;font-family:Arial,sans-serif;padding:26px"><div style="max-width:560px;margin:auto;padding:28px;background:#fff;border-radius:14px"><h1 style="font-size:23px">${vip?'Seu acesso VIP está liberado!':'Bem-vindo ao Segredo da Insulina!'}</h1><p>${safeName}, ${escapeHTML(intro)}</p><div style="padding:16px;background:#f6f3eb;border-radius:10px;margin:16px 0">${credentialsHTML}<p style="margin:0"><strong>Plano:</strong> ${vip?'VIP — upgrade R$ 67':'Básico — R$ 37'}</p></div><p><a href="${safeAppUrl}" style="display:inline-block;background:#173d2f;color:#fff;padding:14px 22px;border-radius:8px;text-decoration:none">Acessar o aplicativo</a></p><p style="font-size:13px;color:#555">Por segurança, altere a senha inicial no primeiro acesso. Se já criou sua senha pessoal, continue usando-a. Não responda este e-mail com sua senha.</p><p>Equipe Clube do Segredo</p></div></body></html>`;
  return { subject, text, html };
}

/** Lembrete transacional somente para quem comprou e nunca entrou no app.
 * Senha provisoria enviada APENAS se o backend confirmou que a conta veio
 * do fluxo de criacao Wiapy e ainda exige a troca de senha.
 */
export function buildNoLoginReminderEmail({ name, email, appUrl, temporaryPassword = null }) {
  const safeName = escapeHTML(String(name || '').trim().split(/\s+/)[0] || 'participante');
  const safeEmail = escapeHTML(email);
  const safeAppUrl = escapeHTML(appUrl);
  const safePass = temporaryPassword ? escapeHTML(temporaryPassword) : null;
  const subject = 'Sua rotina de 21 dias está pronta — falta só entrar 💚';
  const intro = 'Nós preparamos tudo para você no aplicativo: suas receitas, orientações e a rotina organizada para os seus 21 dias. Seu acesso já está liberado. Que tal começar hoje?';
  const passwordHTML = safePass
    ? `<p style="margin:8px 0"><strong>Senha temporária:</strong> ${safePass}</p><p style="font-size:13px;color:#555">A senha é provisória: você precisará criar sua senha pessoal no primeiro acesso.</p>`
    : `<p style="font-size:13px;color:#555">Use a senha que recebeu na confirmação da compra. Se não souber a senha, toque em <strong>Esqueci minha senha</strong> na tela de login.</p>`;
  const passwordText = temporaryPassword
    ? `Senha temporária: ${temporaryPassword}\nAo entrar, crie sua senha pessoal para substituir a temporária.\n`
    : 'Senha: use a que recebeu na compra. Caso não saiba, selecione "Esqueci minha senha" no login.\n';
  const text = `Olá, ${String(name || '').trim().split(/\s+/)[0] || 'tudo bem'}!\n\n${intro}\n\nCOMO ENTRAR NO APLICATIVO\n1. Abra ${appUrl}\n2. No campo E-mail, digite: ${email}\n3. ${passwordText}4. Toque em Entrar.\n\nSe já acessou o aplicativo, desconsidere esta mensagem.\n\nEquipe Clube do Segredo`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f5f3eb;color:#173d2f;font-family:Arial,Helvetica,sans-serif;padding:24px 12px"><div style="margin:0 auto;max-width:560px;border-radius:18px;background:#fff;padding:28px;box-sizing:border-box"><p style="color:#ac812c;font-size:12px;font-weight:700;letter-spacing:1.5px">CLUBE DO SEGREDO</p><h1 style="font-size:25px;line-height:1.2">Sua rotina de 21 dias está pronta 💚</h1><p>Olá, ${safeName}!</p><p>${escapeHTML(intro)}</p><div style="border-radius:12px;background:#f6f3eb;padding:18px;margin:22px 0"><h2 style="font-size:17px;margin:0 0 12px">Como entrar no aplicativo</h2><p style="margin:8px 0"><strong>1.</strong> Acesse pelo botão abaixo.</p><p style="margin:8px 0"><strong>2.</strong> Informe seu e-mail: <strong>${safeEmail}</strong></p><p style="margin:8px 0"><strong>3.</strong> Digite sua senha.</p>${passwordHTML}<p style="margin:8px 0"><strong>4.</strong> Toque em Entrar.</p></div><p style="text-align:center;margin:24px 0"><a href="${safeAppUrl}" style="display:inline-block;background:#173d2f;color:#fff;padding:16px 26px;border-radius:10px;text-decoration:none;font-weight:bold">ACESSAR MEU APLICATIVO</a></p><p style="font-size:13px;color:#636363">Se você já acessou o aplicativo, desconsidere esta mensagem. Não responda este e-mail informando sua senha.</p><p style="font-size:14px">Equipe Clube do Segredo</p></div></body></html>`;
  return {subject,html,text};
}
