import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const src=read('public/js/protocol-main.js');
// Exercise actual UI rendering without a real account or database.
const extract=src.slice(src.indexOf('function pdfOffer(){'),src.indexOf('const el=s=>'));
const nodes=new Map();
const ctx=vm.createContext({profile:null,close(){},screen:'',overlay:null,home(){},document:{createElement(){return {setAttribute(){},querySelectorAll(){return []},querySelector(key){if(!nodes.has(key))nodes.set(key,{addEventListener(){}});return nodes.get(key)}}},body:{append(){}}},sessionStorage:{getItem(){return '1'}},window:{}});
vm.runInContext(extract,ctx);
for(const completed of [false,true]){
 ctx.profile=completed?{age:45,weight_kg:70,height_cm:160}:null;
 for(const view of ['home','day','prep','secrets','onboarding','other']){
 const html=vm.runInContext(`show('<h1>Teste</h1><button id="normal">Continuar</button>',{view:'${view}'}).innerHTML`,ctx);
 assert.ok(html.includes('id="normal"'));
 assert.equal(html.includes('https://pay.wiapy.com/qAaVu3gMsUAQ'),completed&&['home','day'].includes(view));
 }
}
assert.match(read('public/index.html'),/protocol-main\.js\?v=15/);
assert.match(read('public/js/simple-access.js'),/protocol-main\.js\?v=15/);
console.log('OK: PDF oculto antes do questionário e nas telas de edição; exibido após conclusão.');
