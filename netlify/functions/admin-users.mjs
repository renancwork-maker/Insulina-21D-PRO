import { createClient } from '@supabase/supabase-js';
import {randomUUID, randomBytes} from 'node:crypto';
import {createPasswordSetupLink,getAppUrl,sendResendEmail,retireLegacySharedPassword} from './password-invites.mjs';
import {buildPasswordResetEmail} from './email-templates.mjs';

const answer = (json, status=200) => Response.json(json, { status, headers: {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'} });
const validUUID = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');
const normalize = s => String(s||'').trim().toLowerCase();
const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;

async function findAuthUserByEmail(supabase,email) {
  for(let page=1;page<=100;page++) {
    const {data,error}=await supabase.auth.admin.listUsers({page,perPage:1000});
    if(error)throw error;
    const found=(data?.users||[]).find(u=>normalize(u.email)===email);
    if(found)return found;
    if((data?.users||[]).length<1000)break;
  }
  return null;
}

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
      if (url.searchParams.get('view') === 'app_activity') {
        const admins = [...allowed];
        const {data,error} = await supabase.rpc('clube_admin_app_activity',{p_admin_emails:admins});
        if(error)throw error;
        return answer({statistics:data});
      }
      if (url.searchParams.get('view') === 'demographics') {
        const { data, error } = await supabase.rpc('clube_admin_buyer_demographics');
        if (error) throw error;
        return answer({ statistics: data });
      }
      const detail = url.searchParams.get('user');
      if (detail) {
        if (!validUUID(detail)) return answer({error:'invalid_user_id'},400);
        const {data:p,error:pe} = await supabase.from('profiles').select('id,email,name,plan,active,created_at,purchase_date,admin_premium_override').eq('id',detail).single();
        if (pe || !p) return answer({error:'user_not_found'},404);
        const [orders,activity,demographics,appActivity] = await Promise.all([
          supabase.from('wiapy_transactions').select('payment_id,tier,status,amount_cents,created_at,updated_at').eq('user_id',detail).order('created_at',{ascending:false}).limit(100),
          supabase.from('acessos').select('evento,created_at').eq('user_id',detail).order('created_at',{ascending:false}).limit(30),
          supabase.from('customer_demographics').select('age,age_skipped,first_app_os,first_app_seen_at').eq('user_id',detail).maybeSingle(),
          supabase.from('app_user_activity').select('first_open_at,last_open_at,last_seen_at,open_count,pwa_installed_at,pwa_detection,last_os').eq('user_id',detail).maybeSingle(),
        ]);
        if (orders.error || activity.error || demographics.error || appActivity.error) throw orders.error || activity.error || demographics.error || appActivity.error;
        return answer({user:p,orders:orders.data||[],activity:activity.data||[],demographics:demographics.data||null,appActivity:appActivity.data||null});
      }
      const page = Math.max(1,Math.min(10000,Number(url.searchParams.get('page'))||1));
      const term = normalize(url.searchParams.get('search')).slice(0,100).replace(/[,()%]/g,'');
      let query = supabase.from('profiles').select('id,email,name,plan,active,created_at,purchase_date,admin_premium_override',{count:'exact'})
        .order('created_at',{ascending:false}).range((page-1)*50,page*50-1);
      if (term) query = query.or(`email.ilike.%${term}%,name.ilike.%${term}%`);
      const {data,error,count} = await query;
      if (error) throw error;
      const ids=(data||[]).map(u=>u.id);
      let activityByUser=new Map();
      if(ids.length){
        const {data:usage,error:usageErr}=await supabase.from('app_user_activity')
          .select('user_id,last_seen_at,last_open_at,first_open_at,pwa_installed_at')
          .in('user_id',ids);
        if(usageErr)throw usageErr;
        activityByUser=new Map((usage||[]).map(a=>[a.user_id,a]));
      }
      return answer({users:(data||[]).map(u=>({...u,appActivity:activityByUser.get(u.id)||null})),total:count||0,page,pageSize:50});
    }
    const body = await request.json().catch(()=>null);
    // Cadastro manual exclusivo de administrador autenticado. Nunca expor service_role no navegador.
    if (body?.action === 'create_manual') {
      const email=normalize(body.email);
      const tier=body.plan;
      if(!validEmail(email))return answer({error:'invalid_email'},400);
      if(!['basic','premium'].includes(tier))return answer({error:'invalid_plan'},400);
      if(allowed.has(email))return answer({error:'admin_account_protected'},403);
      const {data:existingProfile,error:profileError}=await supabase.from('profiles')
        .select('id,email').eq('email',email).maybeSingle();
      if(profileError)throw profileError;
      let user=await findAuthUserByEmail(supabase,email);
      if(existingProfile?.id && user && existingProfile.id!==user.id)
        return answer({error:'account_conflict'},409);
      let created=false;
      if(!user) {
        const {data:createdAuth,error:createError}=await supabase.auth.admin.createUser({
          email, email_confirm:true,
          password:randomBytes(48).toString('base64url'),
          user_metadata:{source:'admin_manual',must_change_password:true,password_setup_flow:'email_link_v2'},
        });
        if(createError){
          // Caso outro processo tenha criado a conta, localizar sem sobrescrevê-la.
          user=await findAuthUserByEmail(supabase,email);
          if(!user)return answer({error:'auth_creation_failed'},409);
        }else {user=createdAuth?.user;created=true;}
      }
      if(!user?.id || (existingProfile?.id && existingProfile.id!==user.id))
        return answer({error:'account_conflict'},409);
      // Atualiza somente o acesso, preservando a senha pessoal e os dados existentes.
      const {error:upsertError}=await supabase.from('profiles').upsert({
        id:user.id,email,active:true,plan:tier,admin_premium_override:tier==='premium'
      },{onConflict:'id'});
      if(upsertError){
        console.error('manual customer profile update failed:',upsertError.code||'unknown');
        return answer({error:'profile_update_failed',account_created:created},500);
      }
      console.info('manual customer access set',JSON.stringify({admin:auth.user.id,userId:user.id,plan:tier}));
      // Links individuais por Resend; nunca enviar senha temporaria compartilhada.
      try {
        const {data:fresh}=await supabase.auth.admin.getUserById(user.id);
        if(fresh?.user)await retireLegacySharedPassword(supabase,fresh.user);
        const setupUrl=await createPasswordSetupLink(supabase,email,getAppUrl());
        await sendResendEmail({to:email,emailMessage:buildPasswordResetEmail({email,setupUrl}),
          idempotencyKey:`manual-acesso-${user.id}-${randomUUID()}`});
        return answer({ok:true,userId:user.id,created,plan:tier,emailSent:true});
      }catch(mailError){
        console.error('manual customer invite error:',String(mailError?.message||'error').slice(0,90));
        return answer({ok:true,userId:user.id,created,plan:tier,emailSent:false,
          warning:'access_granted_but_invite_failed'});
      }
    }
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
      const appUrl=getAppUrl();
      const {data:authRecord,error:authRecordError}=await supabase.auth.admin.getUserById(body.userId);
      if(authRecordError||!authRecord?.user)return answer({error:'user_not_found'},404);
      await retireLegacySharedPassword(supabase,authRecord.user);
      const setupUrl=await createPasswordSetupLink(supabase,p.email,appUrl);
      await sendResendEmail({to:p.email,
        emailMessage:buildPasswordResetEmail({email:p.email,setupUrl}),
        idempotencyKey:`admin-recuperar-${body.userId}-${randomUUID()}`,
      });
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
