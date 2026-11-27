import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {accountCookie,clearAccountCookie} from './lib/vip-sessions.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;
const COOKIE='clube_simple_access';
function simpleToken(secret,id){const localId=createHmac('sha256',secret).update('clube-local-account-v1:'+id).digest('hex').slice(0,48);const payload=`${Date.now()+30*24*60*60*1000}.${localId}`;return `${payload}.${createHmac('sha256',secret).update('clube-simple-v1:'+payload).digest('hex')}`;}
function readCookie(request){return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
function simpleValid(request,secret){const token=readCookie(request);const [expiry,nonce,sig,...extra]=token.split('.');if(extra.length||!/^\d{13}$/.test(expiry||'')||Number(expiry)<=Date.now()||! /^[a-f0-9]{48}$/.test(nonce||'')||! /^[a-f0-9]{64}$/.test(sig||''))return false;const expected=createHmac('sha256',secret).update('clube-simple-v1:'+expiry+'.'+nonce).digest();return timingSafeEqual(expected,Buffer.from(sig,'hex'));}
function simpleCookie(value,maxAge){return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;}
export default async function handler(request){
 if(request.method!=='POST')return json({error:'method_not_allowed'},405);
 const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,SUPABASE_ANON_KEY,SUPABASE_PUBLISHABLE_KEY}=process.env;
 const publicKey=SUPABASE_PUBLISHABLE_KEY||SUPABASE_ANON_KEY;
 if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!publicKey)return json({error:'service_unavailable'},503);
 let body;try{body=await request.json()}catch{return json({error:'invalid_request'},400)}
 if(body?.action==='simple-status')return simpleValid(request,SUPABASE_SERVICE_ROLE_KEY)?json({ok:true,local_id:readCookie(request).split('.')[1]}):json({error:'access_required'},401);
 if(body?.action==='simple-logout'){const headers=new Headers({'Cache-Control':'no-store','Set-Cookie':simpleCookie('',0)});headers.append('Set-Cookie',clearAccountCookie('account'));headers.append('Set-Cookie',clearAccountCookie('proof'));return Response.json({ok:true},{headers});}
 const input=String(body?.identifier||'').trim(),action=body?.action||'send';
 if(!input||input.length>254||!['send','verify','direct'].includes(action))return json({error:'invalid_identifier'},400);
 const email=input.toLowerCase();
 if(!validEmail(email))return json({error:'invalid_identifier'},400);
 const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,opts),auth=createClient(SUPABASE_URL,publicKey,opts);
 // Same response on send for absent purchases to avoid account enumeration.
 const absent=()=>action==='send'?json({ok:true}):json({error:action==='direct'?'purchase_not_found':'invalid_code'},401);
 try{
  const {data:matched,error:matchError}=await admin.from('profiles').select('id').eq('email',email).maybeSingle();if(matchError)throw matchError;const id=matched?.id;
  if(!id)return absent();
  const {data:p,error:pe}=await admin.from('profiles').select('id,email,active').eq('id',id).maybeSingle();if(pe)throw pe;
  if(!p||p.active===false||!validEmail(p.email||''))return absent();
  const {data:payments,error:te}=await admin.from('wiapy_transactions').select('tier,status').eq('user_id',id).eq('status','paid').limit(100);if(te)throw te;
  if(!(payments||[]).some(x=>['basic','premium'].includes(x.tier)))return absent();
  // Direct access is deliberately NOT a Supabase identity or account session.
  if(action==='direct'){
   // Registrar somente depois de identificar uma compra paga. Não concede identidade Auth.
   const ua=request.headers.get('user-agent')||'';
   const os=/iPhone|iPad|iPod/i.test(ua)?'ios':/Android/i.test(ua)?'android':/Windows|Macintosh|Linux|CrOS/i.test(ua)?'desktop':'other';
   try {
    const {error}=await admin.rpc('clube_registrar_login_simples',{p_user_id:id,p_os:os});
    if(error)throw error;
   } catch(e) {
    // A indisponibilidade do registro não deve impedir uma cliente pagante de entrar.
    console.error('[direct-login-activity]',String(e?.code||'registration_failed').slice(0,80));
   }
   const headers=new Headers({'Cache-Control':'no-store','Set-Cookie':simpleCookie(simpleToken(SUPABASE_SERVICE_ROLE_KEY,id),2592000)});headers.append('Set-Cookie',accountCookie(SUPABASE_SERVICE_ROLE_KEY,id,'account'));return Response.json({ok:true},{headers});
  }
  if(action==='send'){
   const {error}=await auth.auth.signInWithOtp({email:p.email,options:{shouldCreateUser:false}});
   if(error&&![429,400].includes(error.status))throw error;
   return json({ok:true});
  }
  const token=String(body?.code||'').trim();if(!/^\d{6,10}$/.test(token))return json({error:'invalid_code'},401);
  const {data,error}=await auth.auth.verifyOtp({email:p.email,token,type:'email'});
  if(error||!data?.session||data.user?.id!==id)return json({error:'invalid_code'},401);
  // Token is issued by Supabase after successful proof of email ownership.
  const sid=JSON.parse(Buffer.from(data.session.access_token.split('.')[1],'base64url').toString()).session_id;
  if(!/^[0-9a-f-]{36}$/i.test(sid||''))throw Error('missing_session_id');
  const {error:se}=await admin.from('clube_verified_sessions').insert({session_id:sid,user_id:id});if(se)throw se;
  return Response.json({ok:true,access_token:data.session.access_token,refresh_token:data.session.refresh_token},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Set-Cookie':accountCookie(SUPABASE_SERVICE_ROLE_KEY,id,'proof')}});
 }catch(e){console.error('[verified-login]',String(e?.code||e?.message||'error').slice(0,100));return json({error:'service_unavailable'},503);}
}
export const config={path:'/api/purchase-direct-login'};
