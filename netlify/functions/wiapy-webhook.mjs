import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { buildEmail } from './email-templates.mjs';

const response = (payload, status = 200) => Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });
const secureEqual = (a, b) => {
  const aa = Buffer.from(a || '', 'utf8'); const bb = Buffer.from(b || '', 'utf8');
  return aa.length > 0 && aa.length === bb.length && timingSafeEqual(aa, bb);
};
const ids = raw => new Set(String(raw || '').split(',').map(x => x.trim()).filter(Boolean));
const goodEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

function getTier(checkoutId) {
  const basic = ids(process.env.WIAPY_BASIC_CHECKOUT_ID);
  const premium = ids(process.env.WIAPY_PREMIUM_CHECKOUT_ID);
  if (basic.has(checkoutId) && premium.has(checkoutId)) throw new Error('checkout_ids_overlap');
  if (premium.has(checkoutId)) return 'premium';
  if (basic.has(checkoutId)) return 'basic';
  return null;
}

async function getOrCreateUser(admin, email, name) {
  const { data: p, error: pe } = await admin.from('profiles').select('id').eq('email',email).maybeSingle();
  if (pe) throw pe;
  if (p?.id) return p.id;
  // Conta anterior sem profile (paginação é só uma alternativa de migração).
  for (let page = 1; page <= 30; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const existing = data?.users?.find(u => u.email?.toLowerCase() === email);
    if (existing) return existing.id;
    if ((data?.users?.length || 0) < 1000) break;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, password: process.env.INITIAL_ACCESS_PASSWORD, email_confirm: true,
    user_metadata: { name: name || email.split('@')[0], must_change_password: true, source: 'wiapy' },
  });
  if (error) {
    if (!/already|registered|exists/i.test(error.message || '')) throw error;
    const { data: p2, error: e2 } = await admin.from('profiles').select('id').eq('email',email).maybeSingle();
    if (e2) throw e2;
    if (p2?.id) return p2.id;
    throw new Error('auth_user_race_retry');
  }
  if (!data?.user?.id) throw new Error('auth_user_missing');
  return data.user.id;
}

async function updatePurchase(admin, order) {
  const { data, error } = await admin.rpc('wiapy_apply_payment', {
    p_payment_id: order.paymentId, p_user_id: order.userId, p_email: order.email,
    p_checkout_id: order.checkoutId, p_amount_cents: order.amount,
    p_tier: order.tier, p_status: order.status, p_name: order.name,
  });
  if (error) throw error;
  return data;
}

async function sendPurchaseEmail(admin, paymentId, tier, name, email) {
  // Reserva a notificação no banco para impedir envios concorrentes.
  const { data: canSend, error: claimError } = await admin.rpc('wiapy_claim_email', { p_payment_id: paymentId });
  if (claimError) throw claimError;
  if (!canSend) return 'previously_sent_or_processing';
  try {
    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    if (!/^https:\/\//.test(appUrl)) throw new Error('invalid_APP_URL');
    const { subject, html, text } = buildEmail({ tier, name, email, appUrl, initialPassword: process.env.INITIAL_ACCESS_PASSWORD });
    const apiResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type':'application/json', 'Idempotency-Key':`wiapy-${paymentId}` },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [email], subject, html, text }),
    });
    if (!apiResponse.ok) throw new Error(`resend_http_${apiResponse.status}`);
    const sent = await apiResponse.json();
    const { error } = await admin.rpc('wiapy_finish_email', { p_payment_id: paymentId, p_message_id: String(sent.id || '') });
    if (error) throw error;
    return 'sent';
  } catch (error) {
    await admin.rpc('wiapy_release_email', { p_payment_id: paymentId });
    throw error;
  }
}

export default async function handler(request) {
  if (request.method !== 'POST') return response({ ok:false, error:'method_not_allowed' },405);
  if (!secureEqual(request.headers.get('authorization'), process.env.WIAPY_WEBHOOK_TOKEN)) return response({ok:false,error:'not_authorized'},401);
  const required = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','WIAPY_BASIC_CHECKOUT_ID','WIAPY_PREMIUM_CHECKOUT_ID','INITIAL_ACCESS_PASSWORD','RESEND_API_KEY','RESEND_FROM_EMAIL','APP_URL'];
  if (required.some(k => !process.env[k]) || process.env.INITIAL_ACCESS_PASSWORD.length < 10) return response({ok:false,error:'not_configured'},503);
  let body;
  try { body = await request.json(); } catch { return response({ok:false,error:'invalid_json'},400); }
  const checkoutId = String(body?.checkout?.id || '');
  let tier;
  try { tier = getTier(checkoutId); } catch { return response({ok:false,error:'checkout_configuration_error'},503); }
  if (!tier) return response({ok:true,ignored:'other_checkout'});
  const payment = body?.payment || {};
  const paymentId = String(payment.id || '');
  const status = String(payment.status || '');
  const amount = Number(payment.amount);
  const email = String(body?.customer?.email || '').trim().toLowerCase();
  const name = String(body?.customer?.name || '').trim().slice(0,150);
  if (!paymentId) return response({ok:false,error:'missing_payment_id'},400);
  if (!['paid','refunded','chargedback'].includes(status)) return response({ok:true,ignored:'not_paid'});
  if (!goodEmail(email)) return response({ok:false,error:'invalid_email'},400);
  if (status === 'paid' && (!Number.isSafeInteger(amount) || amount <= 0)) return response({ok:false,error:'invalid_amount'},400);
  const admin = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    if (status !== 'paid') {
      const { data, error } = await admin.rpc('wiapy_refund_payment', {p_payment_id:paymentId});
      if (error) throw error;
      return response({ok:true,action:'refund_checked',found:Boolean(data)});
    }
    const userId = await getOrCreateUser(admin,email,name);
    const applied = await updatePurchase(admin,{ paymentId, checkoutId, amount, email, name, tier, userId, status });
    if (applied === 'refunded') return response({ok:true,ignored:'previous_refund'});
    const mail = await sendPurchaseEmail(admin,paymentId,tier,name,email);
    return response({ok:true,action:'purchase_processed',tier,email_status:mail});
  } catch (error) {
    console.error('Wiapy webhook failed:',String(error?.code || error?.message || 'server_error').slice(0,80));
    return response({ok:false,error:'processing_failed'},500);
  }
}
export const config = { path:'/api/wiapy-webhook' };
