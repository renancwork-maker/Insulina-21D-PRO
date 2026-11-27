import {createHmac,timingSafeEqual} from 'node:crypto';
const TTL=30*24*60*60;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function hmac(secret,text){return createHmac('sha256',secret).update(text).digest('hex');}
export const actorKey=(secret,id)=>hmac(secret,'clube-local-account-v1:'+id).slice(0,48);
function cookie(request,name){return (request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
function equal(a,b){return /^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}
export function simpleActor(request,secret){const [expiry,actor,sig,...extra]=cookie(request,'clube_simple_access').split('.');if(extra.length||!/^\d{13}$/.test(expiry||'')||+expiry<=Date.now()||! /^[a-f0-9]{48}$/.test(actor||'')||!equal(sig||'',hmac(secret,'clube-simple-v1:'+expiry+'.'+actor)))return null;return actor;}
export function accountCookie(secret,id,kind){const name=kind==='proof'?'clube_vip_proof':'clube_vip_account',payload=`${Date.now()+TTL*1000}.${id}`;return `${name}=${payload}.${hmac(secret,'clube-vip-'+kind+'-v1:'+payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`;}
export function clearAccountCookie(kind){return `clube_vip_${kind==='proof'?'proof':'account'}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;}
export function accountFromCookie(request,secret,kind){const name=kind==='proof'?'clube_vip_proof':'clube_vip_account';const [expiry,id,sig,...extra]=cookie(request,name).split('.');if(extra.length||!/^\d{13}$/.test(expiry||'')||+expiry<=Date.now()||!uuid.test(id||'')||!equal(sig||'',hmac(secret,'clube-vip-'+kind+'-v1:'+expiry+'.'+id)))return null;return simpleActor(request,secret)===actorKey(secret,id)?id:null;}
