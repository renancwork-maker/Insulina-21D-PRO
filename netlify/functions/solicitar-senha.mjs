import {createHash, randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createPasswordSetupLink, getAppUrl, sendResendEmail, retireLegacySharedPassword} from './password-invites.mjs';
import {buildPasswordResetEmail} from './email-templates.mjs';

const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const generic=()=>reply({ok:true,message:'Se existir uma conta para esse e-mail, enviaremos um link para criar ou redefinir a senha.'});
const digest=value=>createHash('sha256').update(value).digest('hex');
const validEmail=email=>email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default async function handler(request){
  if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
  try {
    const appUrl=getAppUrl();
    // Requisicoes por fetch do app devem vir da origem publicada.
    if(request.headers.get('origin')!==appUrl)return reply({error:'forbidden_origin'},403);
    if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY ||
       !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)return reply({error:'not_configured'},503);
    const body=await request.json().catch(()=>null);
    const email=String(body?.email||'').trim().toLowerCase();
    if(!validEmail(email))return reply({error:'invalid_email'},400);
    const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
      {auth:{persistSession:false,autoRefreshToken:false}});
    // Evita spam, tentativas repetidas e invalidacao frequente de links anteriores.
    // Sem SQL 09 a funcao falha de forma fechada em vez de enviar sem limite.
    const ip=request.headers.get('x-nf-client-connection-ip')||'';
    if(ip){
      const {data:ipAllowed,error:ipErr}=await admin.rpc('clube_password_email_claim',{
        p_key:'ip:'+digest(ip),p_min_seconds:30,
      });
      if(ipErr)throw ipErr;
      if(!ipAllowed)return generic();
    }
    const {data:allowed,error:claimErr}=await admin.rpc('clube_password_email_claim',{
      p_key:'email:'+digest(email),p_min_seconds:600,
    });
    if(claimErr)throw claimErr;
    if(!allowed)return generic();
    // Nunca revela se o e-mail existe no banco.
    const {data:p,error:profileError}=await admin.from('profiles')
      .select('id,email,name').eq('email',email).maybeSingle();
    if(profileError)throw profileError;
    if(!p?.id)return generic();
    const {data:existing,error:authError}=await admin.auth.admin.getUserById(p.id);
    if(authError||!existing?.user)return generic();
    await retireLegacySharedPassword(admin,existing.user);
    const setupUrl=await createPasswordSetupLink(admin,email,appUrl);
    await sendResendEmail({to:email,emailMessage:buildPasswordResetEmail({email,setupUrl,name:p.name}),
      idempotencyKey:`senha-solicitada-${randomUUID()}`});
    return generic();
  }catch(error){
    console.error('[solicitar-senha] falha:',String(error?.code||error?.message||'unknown').slice(0,90));
    return reply({error:'service_unavailable'},503);
  }
}
export const config={path:'/api/solicitar-senha'};
