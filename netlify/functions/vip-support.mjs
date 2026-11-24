import { createClient } from '@supabase/supabase-js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const checkout=()=>'https://pay.wiapy.com/v9cVKwDK5_GC';
export default async function handler(request){
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 const offer={vip:false,price:67,checkout_url:checkout()};
 const bearer=request.headers.get('authorization')||'';
 if(!bearer)return json({...offer,verification_required:true});
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(bearer))return json({error:'invalid_session'},401);
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,SUPABASE_ANON_KEY,SUPABASE_PUBLISHABLE_KEY}=process.env;
 const publicKey=SUPABASE_PUBLISHABLE_KEY||SUPABASE_ANON_KEY;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!publicKey)return json({error:'service_unavailable'},503);
 const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 try{
  const token=bearer.slice(7),admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,opts);
  const {data:identity,error:ie}=await admin.auth.getUser(token);
  if(ie||!identity?.user?.id)return json({error:'invalid_session'},401);
  const client=createClient(SUPABASE_URL,publicKey,{...opts,global:{headers:{Authorization:bearer}}});
  const {data:verified,error:ve}=await client.rpc('clube_protocolo_sessao_segura');
  if(ve)throw ve;
  if(verified!==true)return json({...offer,verification_required:true});
  const {data:paid,error:pe}=await admin.from('wiapy_transactions').select('tier,status').eq('user_id',identity.user.id).eq('tier','premium').eq('status','paid').limit(1);
  if(pe)throw pe;
  if(!paid?.some(x=>x.tier==='premium'&&x.status==='paid'))return json({...offer,verification_required:false});
  // Only a verified purchaser of the VIP checkout receives this number. No public asset contains it.
  return json({vip:true,phone:'(11) 93238-3351',whatsapp:'https://wa.me/5511932383351'});
 }catch(e){console.error('[vip-support]',String(e?.code||e?.message||'error').slice(0,100));return json({error:'service_unavailable'},503)}
}
export const config={path:'/api/vip-support'};
