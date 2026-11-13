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
