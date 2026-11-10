import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const reply = (body, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

const secureEqual = (a, b) => {
  const x = Buffer.from(a || '', 'utf8');
  const y = Buffer.from(b || '', 'utf8');
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};
const allowed = (s) => new Set((s || '').split(',').map(v => v.trim()).filter(Boolean));
const goodEmail = (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

// Em caso de cliente que já existe no Auth, NUNCA substituímos sua senha.
async function findExistingAuthUser(admin, email) {
  const { data: profile, error } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (error) throw error;
  if (profile?.id) return profile.id;

  // Recupera conta preexistente sem profile (por exemplo, banco configurado depois do Auth).
  for (let page = 1; page <= 20; page++) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listError) throw listError;
    const found = data?.users?.find(user => user.email?.toLowerCase() === email);
    if (found) return found.id;
    if ((data?.users?.length || 0) < 1000) break;
  }
  return null;
}

async function grantBuyer(admin, email, name, paymentId, checkoutId, amount) {
  let id = await findExistingAuthUser(admin, email);
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: process.env.INITIAL_ACCESS_PASSWORD,
      email_confirm: true,
      user_metadata: { name: name || email.split('@')[0], must_change_password: true, source: 'wiapy' },
    });
    if (error) {
      // Duas notificações quase simultâneas podem ter criado a conta antes desta chamada.
      if (!/already|registered|exists/i.test(error.message || '')) throw error;
      id = await findExistingAuthUser(admin, email);
      if (!id) throw new Error('Conta existente não localizada; verificar manualmente');
    } else {
      id = data.user?.id;
    }
  }
  if (!id) throw new Error('Supabase não retornou o ID do usuário');

  const { error: profileError } = await admin.from('profiles').upsert({
    id, email, name: name || email.split('@')[0], active: true,
    plan: 'premium', purchase_date: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (profileError) throw profileError;

  const { error: orderError } = await admin.from('wiapy_transactions').upsert({
    payment_id: paymentId, user_id: id, email, checkout_id: checkoutId,
    amount_cents: amount, status: 'paid', updated_at: new Date().toISOString(),
  }, { onConflict: 'payment_id' });
  if (orderError) throw orderError;
  return id;
}

async function revokeBuyer(admin, paymentId) {
  const { data: order, error: findError } = await admin.from('wiapy_transactions')
    .select('user_id,email').eq('payment_id', paymentId).maybeSingle();
  if (findError) throw findError;
  if (!order) return;
  const { error: updateError } = await admin.from('wiapy_transactions')
    .update({ status: 'refunded', updated_at: new Date().toISOString() }).eq('payment_id', paymentId);
  if (updateError) throw updateError;
  const { count, error: countError } = await admin.from('wiapy_transactions')
    .select('payment_id', { count: 'exact', head: true })
    .eq('user_id', order.user_id).eq('status', 'paid');
  if (countError) throw countError;
  if (count === 0) {
    const { error: disableError } = await admin.from('profiles')
      .update({ active: false }).eq('id', order.user_id);
    if (disableError) throw disableError;
  }
}

export default async function handler(request) {
  if (request.method !== 'POST') return reply({ ok: false, message: 'Use POST para notificações Wiapy.' }, 405);
  const token = process.env.WIAPY_WEBHOOK_TOKEN;
  if (!token || !secureEqual(request.headers.get('authorization'), token)) {
    return reply({ ok: false, error: 'not_authorized' }, 401);
  }
  const ids = allowed(process.env.WIAPY_ALLOWED_CHECKOUT_IDS);
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const firstPassword = process.env.INITIAL_ACCESS_PASSWORD;
  if (!url || !serviceKey || !firstPassword || firstPassword.length < 10 || !ids.size) {
    console.error('Webhook Wiapy: variáveis obrigatórias ausentes.');
    return reply({ ok: false, error: 'not_configured' }, 503);
  }

  let payload;
  try { payload = await request.json(); } catch { return reply({ ok: false, error: 'invalid_json' }, 400); }
  const payment = payload?.payment;
  const checkoutId = String(payload?.checkout?.id || '');
  const paymentId = String(payment?.id || '');
  const status = payment?.status;
  const email = String(payload?.customer?.email || '').trim().toLowerCase();
  const name = String(payload?.customer?.name || '').trim().slice(0, 150);
  const amount = Number(payment?.amount);

  // Proíbe aprovar a compra de outros produtos. ID é o campo JSON checkout.id,
  // não o código aleatório da URL pública do checkout.
  if (!ids.has(checkoutId)) return reply({ ok: true, ignored: 'other_checkout' });
  if (!paymentId) return reply({ ok: false, error: 'missing_payment_id' }, 400);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  try {
    if (status === 'refunded' || status === 'chargedback') {
      await revokeBuyer(admin, paymentId);
      return reply({ ok: true, action: 'access_checked_after_refund' });
    }
    // Never create accounts for unpaid PIX, abandoned checkout, etc.
    if (status !== 'paid') return reply({ ok: true, ignored: 'not_paid' });
    if (!goodEmail(email)) return reply({ ok: false, error: 'missing_customer_email' }, 400);
    if (!Number.isSafeInteger(amount) || amount <= 0) return reply({ ok: false, error: 'invalid_amount' }, 400);
    const expected = process.env.WIAPY_EXPECTED_AMOUNT_CENTS;
    if (expected && amount !== Number(expected)) return reply({ ok: true, ignored: 'different_amount' });

    await grantBuyer(admin, email, name, paymentId, checkoutId, amount);
    return reply({ ok: true, action: 'buyer_access_granted' });
  } catch (error) {
    // Não registrar e-mail, token, chave ou dados pessoais nos logs.
    console.error('Webhook Wiapy: falha no processamento', error?.code || error?.name || 'server_error');
    return reply({ ok: false, error: 'processing_failed' }, 500);
  }
}

export const config = { path: '/api/wiapy-webhook' };
