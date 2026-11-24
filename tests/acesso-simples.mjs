import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// Stub only DB/auth transport; never connects to production.
const file=await readFile(new URL('../netlify/functions/purchase-direct-login.mjs',import.meta.url),'utf8');
let otpCalls=0;
globalThis.__mockClient=()=>({from(table){let q={select(){return q},eq(){return q},limit(){return q},maybeSingle(){return q},then(ok,fail){const data=table==='profiles'?{id:'test-id',email:'test@example.com',active:true}:table==='wiapy_transactions'?[{tier:'basic',status:'paid'}]:[{user_id:'test-id'}];return Promise.resolve({data,error:null}).then(ok,fail)}};return q},auth:{signInWithOtp(){otpCalls++;throw Error('not expected')},verifyOtp(){otpCalls++;throw Error('not expected')}}});
const code=file.replace("import { createClient } from '@supabase/supabase-js';",'const createClient=globalThis.__mockClient;');
process.env.SUPABASE_URL='https://mock.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-secret';process.env.SUPABASE_ANON_KEY='test-only-public';
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const req=(body,cookie='')=>new Request('https://test.invalid/api/purchase-direct-login',{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(body)});
for(const identifier of ['test@example.com','11999999999']){const res=await handler(req({action:'direct',identifier}));assert.equal(res.status,200);assert.deepEqual(await res.json(),{ok:true});const c=res.headers.get('set-cookie');assert.match(c,/HttpOnly; Secure; SameSite=Strict/);const cookie=c.split(';')[0];assert.equal((await handler(req({action:'simple-status'},cookie))).status,200);assert.equal((await handler(req({action:'simple-status'},cookie+'x'))).status,401);assert.equal((await handler(req({action:'simple-status'}))).status,401);assert.match((await handler(req({action:'simple-logout'},cookie))).headers.get('set-cookie'),/Max-Age=0/)}assert.equal(otpCalls,0);console.log('OK: e-mail/celular, acesso simples sem OTP ou token Supabase; cookie assinado, adulteração rejeitada, logout.');
