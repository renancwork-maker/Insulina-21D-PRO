import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const src=read('public/js/protocol-main.js');
// Exercise actual UI rendering without a real account or database.
const extract=src.slice(src.indexOf('function pdfOffer(){'),src.indexOf('const el=s=>'));
const nodes=new Map();
const ctx=vm.createContext({close(){},screen:'',overlay:null,home(){},document:{createElement(){return {setAttribute(){},querySelector(key){if(!nodes.has(key))nodes.set(key,{addEventListener(){}});return nodes.get(key)}}},body:{append(){}}},sessionStorage:{getItem(){return '1'}},window:{}});
vm.runInContext(extract,ctx);
for(const view of ['home','prep','secrets','onboarding','other']){
 const html=vm.runInContext(`show('<h1>Teste</h1><button id="normal">Continuar</button>',{view:'${view}'}).innerHTML`,ctx);
 assert.ok(html.includes('id="normal"'));
 assert.equal(html.includes('https://pay.wiapy.com/qAaVu3gMsUAQ'),view!=='other');
 if(view!=='other'){assert.match(html,/Compra opcional/);assert.match(html,/não precisa comprar novamente/);assert.match(html,/target="_blank" rel="noopener noreferrer"/)}
}
assert.match(src,/view:edit\?'other':'onboarding'/);
assert.match(read('public/index.html'),/protocol-main\.js\?v=11/);
assert.match(read('public/js/simple-access.js'),/protocol-main\.js\?v=11/);
console.log('OK: oferta PDF renderizada nas quatro telas, checkout correto e acesso comum preservado.');
