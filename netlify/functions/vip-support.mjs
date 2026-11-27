import { createClient } from '@supabase/supabase-js';
import {accountCookie,accountFromCookie} from './lib/vip-sessions.mjs';
const json=(data,status=200,cookie=null)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
const checkout=()=>'https://pay.wiapy.com/v9cVKwDK5_GC';
export default async function handler(request){
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 const offer={vip:false,price:67,checkout_url:checkout()};
 let destination='support';
 try{if(request.headers.get('content-type')?.includes('application/json'))destination=(await request.json()).destination||'support';}catch{return json({error:'invalid_request'},400);}
 if(!['support','community'].includes(destination))return json({error:'invalid_request'},400);
 const bearer=request.headers.get('authorization')||'';
 if(bearer&&!/^Bearer [A-Za-z0-9._-]+$/.test(bearer))return json({error:'invalid_session'},401);
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,SUPABASE_ANON_KEY,SUPABASE_PUBLISHABLE_KEY}=process.env;
 const publicKey=SUPABASE_PUBLISHABLE_KEY||SUPABASE_ANON_KEY;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!publicKey)return json({error:'service_unavailable'},503);
 const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 try{
  let userId,verified=false;
  const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,opts);
  if(bearer){
   const token=bearer.slice(7);const {data:identity,error:ie}=await admin.auth.getUser(token);
   if(ie||!identity?.user?.id)return json({error:'invalid_session'},401);
   userId=identity.user.id;
   const client=createClient(SUPABASE_URL,publicKey,{...opts,global:{headers:{Authorization:bearer}}});
   const {data,error:ve}=await client.rpc('clube_protocolo_sessao_segura');if(ve)throw ve;verified=data===true;
  }else{
   const proof=accountFromCookie(request,SUPABASE_SERVICE_ROLE_KEY,'proof');
   userId=proof||accountFromCookie(request,SUPABASE_SERVICE_ROLE_KEY,'account');verified=!!proof;
  }
  if(!userId)return json({...offer,verification_required:true});
  const {data:paid,error:pe}=await admin.from('wiapy_transactions').select('tier,status').eq('user_id',userId).eq('tier','premium').eq('status','paid').gt('amount_cents',0).limit(1);
  if(pe)throw pe;
  if(!paid?.some(x=>x.tier==='premium'&&x.status==='paid'))return json({...offer,verification_required:!verified});
  if(!verified)return json({...offer,vip_pending:true,verification_required:true});
  // Only after email ownership verification and a real approved premium payment.
  const invite=(process.env.VIP_COMMUNITY_WHATSAPP_URL||'').trim();
  const communityConfigured=/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{10,100}$/.test(invite);
  return json({vip:true,community_configured:communityConfigured,...(destination==='community'&&communityConfigured?{community_url:invite}:{}),phone:'(11) 93238-3351',whatsapp:'https://wa.me/5511932383351'},200,bearer?accountCookie(SUPABASE_SERVICE_ROLE_KEY,userId,'proof'):null);
 }catch(e){console.error('[vip-support]',String(e?.code||e?.message||'error').slice(0,100));return json({error:'service_unavailable'},503)}
}
export const config={path:'/api/vip-support'};
