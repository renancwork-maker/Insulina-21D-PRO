import {createClient} from '@supabase/supabase-js';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default async function handler(request){
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  const auth=String(request.headers.get('authorization')||'');
  const token=/^Bearer (.+)$/i.exec(auth)?.[1]||'';
  if(!token)return json({error:'not_authenticated'},401);
  const {SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY}=process.env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY)return json({error:'service_unavailable'},503);
  const supabase=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
  try{
    const {data:identity,error:authError}=await supabase.auth.getUser(token);
    if(authError||!identity?.user?.id||!identity.user.email)return json({error:'not_authenticated'},401);
    const user=identity.user;
    const email=user.email.trim().toLowerCase();
    const {data:existing,error:profileError}=await supabase.from('profiles')
      .select('id,email,name,plan,active,purchase_date,timezone').eq('id',user.id).maybeSingle();
    if(profileError)throw profileError;
    if(existing){
      if(existing.active===false)return json({error:'account_inactive'},403);
      return json({ok:true,profile:existing,repaired:false});
    }
    // Nunca criar perfil so porque existe usuario no Auth. Exigir pagamento aprovado.
    const {data:transactions,error:paymentsError}=await supabase.from('wiapy_transactions')
      .select('tier,status,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
    if(paymentsError)throw paymentsError;
    const paid=(transactions||[]).filter(x=>x.status==='paid' && ['basic','premium'].includes(x.tier));
    if(!paid.length)return json({error:'no_approved_purchase'},403);
    const tier=paid.some(x=>x.tier==='premium')?'premium':'basic';
    // Apenas inserir se nao existe; evitar reativar conta bloqueada por outra acao.
    const {error:insertError}=await supabase.from('profiles').insert({
      id:user.id,email,active:true,plan:tier,
    });
    if(insertError && insertError.code!=='23505')throw insertError;
    const {data:profile,error:readError}=await supabase.from('profiles')
      .select('id,email,name,plan,active,purchase_date,timezone').eq('id',user.id).single();
    if(readError||!profile)throw readError||new Error('profile_not_available');
    if(profile.active===false)return json({error:'account_inactive'},403);
    console.info('[repair-my-access] profile verified',user.id,'repaired',!insertError);
    return json({ok:true,profile,repaired:!insertError});
  }catch(error){
    console.error('[repair-my-access]',String(error?.code||error?.message||'unknown').slice(0,90));
    return json({error:'verification_unavailable'},503);
  }
}
export const config={path:'/api/repair-my-access'};
