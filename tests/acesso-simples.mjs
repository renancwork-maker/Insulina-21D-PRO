import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Stub only DB/auth transport; never connects to production.
const file=await readFile(new URL('../netlify/functions/purchase-direct-login.mjs',import.meta.url),'utf8');
let otpCalls=0;let writes=[];let paid=true;let active=true;let rpcFail=false;
globalThis.__mockClient=()=>({rpc:async(name,args)=>{writes.push({name,args});return {error:rpcFail?{code:"TEST_ERROR"}:null}},from(table){let q={select(){return q},eq(){return q},limit(){return q},maybeSingle(){return q},then(ok,fail){const data=table==='profiles'?{id:'test-id',email:'test@example.com',active:active}:table==='wiapy_transactions'?(paid?[{tier:'basic',status:'paid'}]:[]):[{user_id:'test-id'}];return Promise.resolve({data,error:null}).then(ok,fail)}};return q},auth:{signInWithOtp(){otpCalls++;throw Error('not expected')},verifyOtp(){otpCalls++;throw Error('not expected')}}});
const code=file.replace("import { createClient } from '@supabase/supabase-js';",'const createClient=globalThis.__mockClient;').replace('./lib/vip-sessions.mjs',new URL('../netlify/functions/lib/vip-sessions.mjs',import.meta.url).href);
process.env.SUPABASE_URL='https://mock.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-secret';process.env.SUPABASE_ANON_KEY='test-only-public';
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const req=(body,cookie='')=>new Request('https://test.invalid/api/purchase-direct-login',{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(body)});
for(const identifier of ['test@example.com','TEST@example.com']){const res=await handler(req({action:'direct',identifier}));assert.equal(res.status,200);assert.deepEqual(await res.json(),{ok:true});const c=res.headers.get('set-cookie');assert.match(c,/HttpOnly; Secure; SameSite=Strict/);const cookie=c.split(';')[0];assert.equal((await handler(req({action:'simple-status'},cookie))).status,200);assert.equal((await handler(req({action:'simple-status'},cookie+'x'))).status,401);assert.equal((await handler(req({action:'simple-status'}))).status,401);assert.match((await handler(req({action:'simple-logout'},cookie))).headers.get('set-cookie'),/Max-Age=0/)}assert.equal(otpCalls,0);console.log('OK: e-mail, acesso simples sem OTP ou token Supabase; cookie assinado, adulteração rejeitada, logout.');

assert.equal(writes.length,2);for(const w of writes){assert.equal(w.name,'clube_registrar_login_simples');assert.equal(w.args.p_user_id,'test-id');}
paid=false;assert.equal((await handler(req({action:'direct',identifier:'test@example.com'}))).status,401);assert.equal(writes.length,2);
paid=true;active=false;assert.equal((await handler(req({action:'direct',identifier:'test@example.com'}))).status,401);assert.equal(writes.length,2);
active=true;rpcFail=true;assert.equal((await handler(req({action:'direct',identifier:'test@example.com'}))).status,200);assert.equal(writes.length,3);assert.equal(otpCalls,0);console.log('OK: registros apenas para compras válidas; falha de telemetria não bloqueia login.');

paid=true;active=true;rpcFail=false;
const getLocalId=async identifier=>{const r=await handler(req({action:'direct',identifier}));const cookie=r.headers.get('set-cookie').split(';')[0];return (await (await handler(req({action:'simple-status'},cookie))).json()).local_id};
for(const action of ['direct','send','verify'])assert.equal((await handler(req({action,identifier:'11999999999'}))).status,400);
assert.equal(await getLocalId('test@example.com'),await getLocalId('test@example.com'));
console.log('OK: identificador persistente por comprador, por e-mail.');
