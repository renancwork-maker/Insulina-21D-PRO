import { createClient } from '@supabase/supabase-js';

// ATENÇÃO: este endpoint implementa acesso apenas por identificador de compra.
// Conhecer o e-mail/telefone de um comprador será suficiente para entrar na conta dele.
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
function phoneDigits(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'service_unavailable' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_request' }, 400); }
  const input = String(body?.identifier || '').trim();
  if (!input || input.length > 254) return json({ error: 'invalid_identifier' }, 400);
  const email = input.includes('@') ? input.toLowerCase() : null;
  const phone = email ? null : phoneDigits(input);
  if ((!email || !validEmail(email)) && !phone) return json({ error: 'invalid_identifier' }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    let userId;
    if (email) {
      const { data, error } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
      if (error) throw error;
      userId = data?.id;
    } else {
      const { data, error } = await admin.from('wiapy_purchase_contacts')
        .select('user_id').eq('phone_digits', phone).order('created_at', { ascending: false }).limit(2);
      if (error) {
        console.error('[direct-login] contacts lookup unavailable', error.code || 'db_error');
        return json({ error: 'phone_lookup_unavailable' }, 503);
      }
      // Não permitir entrar caso este telefone esteja vinculado a contas diferentes.
      const uniqueIds = [...new Set((data || []).map(row => row.user_id))];
      if (uniqueIds.length !== 1) return json({ error: 'purchase_not_found' }, 403);
      userId = uniqueIds[0];
    }
    if (!userId) return json({ error: 'purchase_not_found' }, 403);
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('id,email,active').eq('id', userId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.active === false || !validEmail(profile.email || '')) return json({ error: 'purchase_not_found' }, 403);
    const { data: purchases, error: paymentError } = await admin.from('wiapy_transactions')
      .select('tier,status').eq('user_id', userId).eq('status', 'paid').limit(30);
    if (paymentError) throw paymentError;
    if (!(purchases || []).some(p => ['basic', 'premium'].includes(p.tier))) return json({ error: 'purchase_not_found' }, 403);

    // Gerar token de login na API Admin: não dispara e-mail, preserva a sessão exigida pelo aplicativo.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: profile.email });
    if (linkError || !link?.properties?.hashed_token) throw linkError || new Error('missing_hashed_token');
    return json({ ok: true, token_hash: link.properties.hashed_token });
  } catch (error) {
    console.error('[direct-login] failed', String(error?.code || error?.message || 'unknown').slice(0, 90));
    return json({ error: 'service_unavailable' }, 503);
  }
}
export const config = { path: '/api/purchase-direct-login' };
