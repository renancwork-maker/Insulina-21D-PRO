import { createClient } from '@supabase/supabase-js';

const answer = (json, status=200) => Response.json(json, { status, headers: {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'} });
const validUUID = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');
const normalize = s => String(s||'').trim().toLowerCase();

export default async function handler(request) {
  if (!['GET','POST'].includes(request.method)) return answer({error:'method_not_allowed'},405);
  const vars = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMAILS'];
  if (vars.some(k => !process.env[k])) return answer({error:'admin_not_configured'},503);
  const bearer = /^Bearer (\S+)$/i.exec(request.headers.get('authorization')||'');
  if (!bearer) return answer({error:'authentication_required'},401);
  const supabase = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  try {
    // A identidade vem do Supabase Auth, NUNCA do e-mail fornecido pelo navegador.
    const {data:auth,error:authError} = await supabase.auth.getUser(bearer[1]);
    if (authError || !auth?.user?.id || !auth.user.email_confirmed_at) return answer({error:'invalid_session'},401);
    const allowed = new Set(process.env.ADMIN_EMAILS.split(',').map(normalize).filter(Boolean));
    if (!allowed.has(normalize(auth.user.email))) return answer({error:'admin_only'},403);

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const detail = url.searchParams.get('user');
      if (detail) {
        if (!validUUID(detail)) return answer({error:'invalid_user_id'},400);
        const {data:p,error:pe} = await supabase.from('profiles').select('id,email,name,plan,active,created_at,purchase_date,admin_premium_override').eq('id',detail).single();
        if (pe || !p) return answer({error:'user_not_found'},404);
        const [orders,activity] = await Promise.all([
          supabase.from('wiapy_transactions').select('payment_id,tier,status,amount_cents,created_at,updated_at').eq('user_id',detail).order('created_at',{ascending:false}).limit(100),
          supabase.from('acessos').select('evento,created_at').eq('user_id',detail).order('created_at',{ascending:false}).limit(30),
        ]);
        if (orders.error || activity.error) throw orders.error || activity.error;
        return answer({user:p,orders:orders.data||[],activity:activity.data||[]});
      }
      const page = Math.max(1,Math.min(10000,Number(url.searchParams.get('page'))||1));
      const term = normalize(url.searchParams.get('search')).slice(0,100).replace(/[,()%]/g,'');
      let query = supabase.from('profiles').select('id,email,name,plan,active,created_at,purchase_date,admin_premium_override',{count:'exact'})
        .order('created_at',{ascending:false}).range((page-1)*50,page*50-1);
      if (term) query = query.or(`email.ilike.%${term}%,name.ilike.%${term}%`);
      const {data,error,count} = await query;
      if (error) throw error;
      return answer({users:data||[],total:count||0,page,pageSize:50});
    }
    const body = await request.json().catch(()=>null);
    if (!body || !validUUID(body.userId)) return answer({error:'invalid_user_id'},400);
    if (body.userId === auth.user.id) return answer({error:'cannot_change_own_account'},403);
    if (body.action === 'premium') {
      if (![true,false,null].includes(body.override)) return answer({error:'invalid_override'},400);
      const {error} = await supabase.rpc('clube_admin_set_premium',{
        p_admin_id:auth.user.id,p_user_id:body.userId,p_override:body.override,
      });
      if (error) throw error;
      return answer({ok:true});
    }
    if (body.action === 'reset') {
      const {data:p,error:pe} = await supabase.from('profiles').select('email').eq('id',body.userId).single();
      if (pe || !p?.email) return answer({error:'user_not_found'},404);
      const appUrl = String(process.env.APP_URL || '').replace(/\/$/,'');
      if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(appUrl)) return answer({error:'APP_URL_not_configured'},503);
      const {error} = await supabase.auth.resetPasswordForEmail(p.email,{redirectTo: `${appUrl}/recuperar`});
      if (error) throw error;
      await supabase.from('admin_audit_log').insert({admin_user_id:auth.user.id,target_user_id:body.userId,event:'password_reset_requested'});
      return answer({ok:true});
    }
    return answer({error:'invalid_action'},400);
  } catch (e) {
    console.error('admin-users:',String(e?.code||e?.message||'server_error').slice(0,120));
    return answer({error:'server_error'},500);
  }
}
export const config = {path:'/api/admin-users'};
