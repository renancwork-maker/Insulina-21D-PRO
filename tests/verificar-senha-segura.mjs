import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildEmail,buildNoLoginReminderEmail,buildPasswordResetEmail} from '../netlify/functions/email-templates.mjs';
import {createPasswordSetupLink,retireLegacySharedPassword} from '../netlify/functions/password-invites.mjs';

const base={name:'Ana <Teste>',email:'ana@example.com',appUrl:'https://app.example.com',setupUrl:'https://app.example.com/criar-senha/?token_hash=secret'};
for(const email of [buildEmail({...base,tier:'basic'}),buildEmail({...base,tier:'premium',setupUrl:null}),buildNoLoginReminderEmail(base),buildPasswordResetEmail(base)]){
  assert.ok(email.html.includes('href="https://'));
  assert.ok(!email.html.includes('Ana <Teste>'));
  assert.ok(!/senha provis.ria|senha tempor.ria/i.test(email.html));
  assert.ok(!/insulina123/i.test(email.text));
}
const link=await createPasswordSetupLink({auth:{admin:{generateLink:async()=>({data:{properties:{hashed_token:'abc123'}}})}}},'ana@example.com',base.appUrl);
assert.equal(link,'https://app.example.com/criar-senha/?token_hash=abc123');
const changes=[];
const legacy={id:'example-uuid',user_metadata:{source:'wiapy',must_change_password:true,name:'Ana'}};
const admin={auth:{admin:{updateUserById:async(id,update)=>{changes.push({id,update});return {error:null};}}}};
assert.equal(await retireLegacySharedPassword(admin,legacy),true);
assert.equal(changes.length,1);
assert.notEqual(changes[0].update.password,['insulina','123@'].join(''));
assert.ok(changes[0].update.password.length>40);
assert.equal(changes[0].update.user_metadata.password_setup_flow,'email_link_v2');
assert.equal(await retireLegacySharedPassword(admin,{...legacy,user_metadata:{...legacy.user_metadata,must_change_password:false}}),false);
assert.equal(changes.length,1);

const script=readFileSync(new URL('../public/js/criar-senha.js',import.meta.url),'utf8');
function fakeElement(){
  const styles=new Set();
  return {textContent:'',value:'',disabled:false,className:'',
    handlers:{},classList:{add:x=>styles.add(x),remove:x=>styles.delete(x),contains:x=>styles.has(x)},
    addEventListener(event,handler){this.handlers[event]=handler;}};
}
const els=Object.fromEntries(['feedback','password-form','submit','password','confirm-password','intro','success','title'].map(x=>[x,fakeElement()]));
const requests=[];
let removedPath=null;
const context={
  URLSearchParams,
  location:{search:'?token_hash=abc123abc123',pathname:'/criar-senha/'},
  history:{replaceState(a,b,c){removedPath=c;}},
  document:{getElementById:id=>els[id]},
  window:{APP_SUPABASE_URL:'https://abc.supabase.co',APP_SUPABASE_ANON_KEY:'sb_publishable_example'},
  fetch:async (url,opts)=>{
    requests.push({url,opts});
    return {ok:true,json:async()=>url.endsWith('/verify')?{access_token:'user_jwt'}:{user:{id:'user-id'}}};
  },
};
vm.runInNewContext(script,context);
assert.equal(removedPath,'/criar-senha/');
els.password.value='senha-segura-123';
els['confirm-password'].value='senha-segura-123';
await els['password-form'].handlers.submit({preventDefault(){}});
assert.equal(requests.length,2);
assert.ok(requests[0].url.endsWith('/auth/v1/verify'));
assert.ok(requests[1].url.endsWith('/auth/v1/user'));
const first=JSON.parse(requests[0].opts.body);
const second=JSON.parse(requests[1].opts.body);
assert.equal(first.type,'recovery');
assert.equal(first.token_hash,'abc123abc123');
assert.equal(second.password,'senha-segura-123');
assert.equal(second.data.must_change_password,false);
assert.equal(requests[1].opts.headers.Authorization,'Bearer user_jwt');
assert.ok(els.success.classList.contains('hidden')===false);
console.log('OK: e-mails, link individual, rotacao de senha legada e formulario seguro');
