import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildEmail,buildNoLoginReminderEmail} from '../netlify/functions/email-templates.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=read('public/index.html');
const links=[...home.matchAll(/class="buy" href="([^"]+)"/g)].map(x=>x[1]);
assert.deepEqual(links,['5uQh8PfINwT_','TsnUL0YyVs4_','MlXlvKkfGYEA','XbLpZk7aX1Rv','s3QXQ-EbQltQ','qeCDn0Nol6jT'].map(x=>'https://pay.wiapy.com/'+x));
assert.ok(home.includes('class="app-button" href="/app"'));
assert.ok(!home.includes('/js/config.js'));
const compat=home.match(/<script>([\s\S]+?)<\/script>/)[1];
for(const [search,hash,standalone,expected] of [['','',false,null],['?utm_source=teste','',false,null],['?protocolo=dia-1','',false,'/app?protocolo=dia-1'],['?privado=1&vip=1','',false,'/app?privado=1&vip=1'],['?origem=instalado','',false,'/app?origem=instalado'],['','#access_token=mock',false,'/app#access_token=mock'],['','',true,'/app']]){
 let called=null;vm.runInNewContext(compat,{URLSearchParams,location:{search,hash,replace:x=>called=x},navigator:{standalone},window:{matchMedia:()=>({matches:standalone})}});assert.equal(called,expected);
}
const redirects=read('public/_redirects');assert.match(redirects,/^\/app\s+\/app.html\s+200$/m);assert.match(redirects,/^\/app\/simples\s+\/acesso-simples.html\s+200$/m);assert.match(redirects,/^\/app\/\*\s+\/app.html\s+200$/m);assert.ok(redirects.indexOf('/app/simples')<redirects.indexOf('/app/*'));assert.ok(!/^\/\*\s/m.test(redirects));
assert.ok(read('public/app.html').includes('/js/email-otp-login.js'));assert.ok(read('public/js/index-app-dia1a21-v3.js').includes('basename:"/app"'));assert.ok(read('public/js/email-otp-login.js').includes("location.assign('/app/simples'"));assert.ok(read('public/js/simple-access.js').includes("location.replace('/app?novo=1')"));
const manifest=JSON.parse(read('public/manifest.webmanifest'));assert.equal(manifest.id,'/');assert.equal(manifest.start_url,'/app?origem=instalado');
for(const builder of [buildEmail,buildNoLoginReminderEmail]){const email=builder({email:'teste@example.com',name:'Teste',appUrl:'https://exemplo.invalid'});assert.ok(email.html.includes('href="https://exemplo.invalid/app"'));assert.ok(email.text.includes('https://exemplo.invalid/app'));}
console.log('OK: seis checkouts, CTA, rotas estáticas, links antigos, PWA e e-mails novos apontam para /app.');
