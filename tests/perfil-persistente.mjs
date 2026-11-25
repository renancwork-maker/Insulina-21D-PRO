import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../public/js/simple-access.js',import.meta.url),'utf8');
const storage=new Map();const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
async function start(id){const window={};const ctx=vm.createContext({window,localStorage,fetch:async(_,r)=>({ok:true,json:async()=>({local_id:id})}),document:{getElementById:()=>({}),createElement:()=>({}),body:{append(){}}},location:{replace(){}}});vm.runInContext(code,ctx);await new Promise(r=>setImmediate(r));return window;}
const a='a'.repeat(48),b='b'.repeat(48);let w=await start(a);const table='clube_protocol_profiles';assert.equal((await w.__clubeSupabase.from(table).select().maybeSingle()).data,null);
await w.__clubeSupabase.from(table).upsert({age:42,weight_kg:70,height_cm:165}).single();await w.__clubeSupabase.from('journey_starts').upsert({start_date:'2026-11-25',ingredients_confirmed:true});await w.__clubeSimpleExit();
w=await start(b);assert.equal((await w.__clubeSupabase.from(table).select().maybeSingle()).data,null);await w.__clubeSupabase.from(table).upsert({age:55,weight_kg:80,height_cm:170});await w.__clubeSimpleExit();
w=await start(a);assert.equal((await w.__clubeSupabase.from(table).select().maybeSingle()).data.age,42);assert.equal((await w.__clubeSupabase.from('journey_starts').select().maybeSingle()).data.start_date,'2026-11-25');w.__clubeSimpleClear();assert.equal((await w.__clubeSupabase.from(table).select().maybeSingle()).data,null);w=await start(b);assert.equal((await w.__clubeSupabase.from(table).select().maybeSingle()).data.age,55);console.log('OK: perfil e jornada persistem após sair e entrar; contas separadas; exclusão individual.');
