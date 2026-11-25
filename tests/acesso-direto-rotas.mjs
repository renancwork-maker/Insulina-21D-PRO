import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {buildEmail,buildNoLoginReminderEmail} from '../netlify/functions/email-templates.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const home=read('public/index.html');
assert.ok(home.includes('id="root"') && home.includes('/js/config.js') && home.includes('/js/email-otp-login.js'));
assert.ok(!home.includes('vitrine.css') && !home.includes('pay.wiapy.com/5uQh8PfINwT_'));
assert.ok(!existsSync(new URL('../public/app.html',import.meta.url)));
const routes=read('public/_redirects');
assert.match(routes,/^\/app\s+\/\s+302!$/m);
assert.match(routes,/^\/app\/simples\s+\/acesso-simples.html\s+302$/m);
assert.match(routes,/^\/app\/\*\s+\/:splat\s+302$/m);
assert.ok(routes.indexOf('/app/simples')<routes.indexOf('/app/*'));
assert.ok(routes.indexOf('/app/*')<routes.indexOf('/*   /index.html'));
assert.ok(!read('public/js/index-app-dia1a21-v3.js').includes('basename:"/app"'));
assert.ok(read('public/js/email-otp-login.js').includes("location.assign('/acesso-simples.html'"));
assert.equal(JSON.parse(read('public/manifest.webmanifest')).start_url,'/?origem=instalado');
for(const fn of [buildEmail,buildNoLoginReminderEmail]){const mail=fn({name:'Teste',email:'teste@example.com',appUrl:'https://exemplo.invalid/app'});assert.ok(mail.html.includes('href="https://exemplo.invalid/"'));assert.ok(mail.text.includes('Aplicativo: https://exemplo.invalid/'));}
console.log('OK: acesso direto, compatibilidade /app, PWA e links dos e-mails.');
