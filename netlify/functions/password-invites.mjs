import {randomBytes} from 'node:crypto';
/** Links de criacao/redefinicao de senha sao gerados pelo Supabase Auth.
 * A URL entregue por Resend aponta para uma pagina nossa, que SO consome o token
 * no POST de confirmacao feito pelo proprio cliente. Previews de e-mail nao o consomem.
 */
export function getAppUrl() {
  const raw = String(process.env.APP_URL || '').replace(/\/+$/, '');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('APP_URL_invalida');
  }
  return url.origin;
}

export async function createPasswordSetupLink(supabaseAdmin, email, appUrl = getAppUrl()) {
  const {data, error} = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery', email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error('falha_gerar_link_de_senha');
  }
  const url = new URL('/criar-senha/', appUrl);
  url.searchParams.set('token_hash', data.properties.hashed_token);
  return url.toString();
}

export async function sendResendEmail({to, emailMessage, idempotencyKey}) {
  const key=String(process.env.RESEND_API_KEY || '');
  const sender=String(process.env.RESEND_FROM_EMAIL || '');
  if (!key || !sender) throw new Error('resend_nao_configurado');
  const headers={Authorization:`Bearer ${key}`, 'Content-Type':'application/json'};
  if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
  const res=await fetch('https://api.resend.com/emails', {
    method:'POST', headers,
    body:JSON.stringify({from:sender,to:[to],subject:emailMessage.subject,
      html:emailMessage.html,text:emailMessage.text}),
  });
  if(!res.ok)throw new Error(`resend_http_${res.status}`);
  const data=await res.json();
  return String(data.id||'');
}

/** Rotaciona a senha global usada por versoes anteriores somente em contas
 * Wiapy que ainda nao estabeleceram senha pessoal. Pode ser executada mais
 * de uma vez; nao altera contas de quem ja escolheu sua propria senha.
 */
export async function retireLegacySharedPassword(supabaseAdmin, user) {
  const meta = user?.user_metadata || {};
  if(meta.source !== 'wiapy' || meta.must_change_password !== true || meta.password_setup_flow === 'email_link_v2') {
    return false;
  }
  const {error} = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: randomBytes(48).toString('base64url'),
    user_metadata: {...meta, password_setup_flow:'email_link_v2'},
  });
  if(error) throw new Error('legacy_password_rotation_failed');
  return true;
}
