import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx={window:{},Intl,Date};vm.runInNewContext(fs.readFileSync(new URL('../public/js/protocol-model.js',import.meta.url),'utf8'),ctx);const M=ctx.window.ProtocolModel;
const p={age:65,weight_kg:65,height_cm:155,activity:'light',needs_review:false,weekly_choices:{}};
assert.equal(M.metrics(p).water,1950);assert.equal(M.metrics(p).kcal,1529);assert.equal(M.metrics(p).review,false);
assert.equal(M.metrics({...p,weight_kg:80}).water,2400);assert.equal(M.metrics({...p,needs_review:true}).review,true);assert.equal(M.portion({...p,needs_review:true},0,0),null);
for(const w of [65,75,90]){const person={...p,weight_kg:w};for(let d=1;d<=21;d++){let total=50;for(let m=0;m<4;m++){assert.equal(M.choice(person,d,m),M.choice(person,(d-1)%7+1,m));for(let o=0;o<4;o++){const q=M.portion(person,m,o);assert.ok(q.kcal>0);assert.ok(Math.abs(q.kcal-(M.metrics(person).kcal-50)*M.meals[m].share)<25);assert.ok(Object.values(q.items).every(v=>v>0));}total+=M.portion(person,m,M.choice(person,d,m)).kcal;}assert.ok(Math.abs(total-M.metrics(person).kcal)<50);}}
assert.equal(M.choice({...p,weekly_choices:{'1-0':3}},8,0),3);assert.notDeepEqual(M.shopping(p),M.shopping({...p,weekly_choices:{'1-0':3}}));assert.equal(M.shift('2026-12-01',-1),'2026-11-30');assert.equal(M.diff('2027-01-01','2026-12-31'),1);assert.equal(M.diff('2026-12-22','2026-12-01')+1,22);
console.log('OK: hidratação, calorias aproximadas, 4 opções, repetição 21 dias, lista dinâmica, casos de revisão e datas.');
// Todas as refeições e substituições incluem exatamente uma fruta; trocar fruta preserva a meta energética.
for(const w of [65,75,90])for(let day=1;day<=21;day++)for(let m=0;m<4;m++)for(let o=0;o<4;o++)for(const fruit of M.fruits){
 const person={...p,weight_kg:w,weekly_choices:{[`fruit-${(day-1)%7+1}-${m}`]:fruit}};
 const q=M.portion(person,m,o,day);
 assert.equal(q.fruit,fruit);assert.equal(Object.keys(q.items).filter(k=>M.fruits.includes(k)).length,1);
 assert.ok(q.items[fruit]>0);assert.ok(Math.abs(q.kcal-(M.metrics(person).kcal-50)*M.meals[m].share)<25);
}
const picked={...p,weekly_choices:{'fruit-1-1':'morango'}};
assert.equal(M.fruitChoice(picked,8,1,0),'morango');assert.equal(M.fruitChoice(picked,15,1,0),'morango');
assert.ok(M.shopping(picked).morango>0);assert.ok(!M.shopping(p).morango);assert.ok(M.shopping(picked).maca<M.shopping(p).maca);
assert.equal(M.fruitChoice({...p,weekly_choices:{'fruit-1-1':'invalid'}},1,1,0),'maca');
console.log('OK: 10 frutas × 4 refeições × 4 opções × 21 dias × 3 perfis; lista de compras, repetição e substituição sem duplicidade.');
for(const age of [18,25,34,35,65,110]) assert.ok(Number.isFinite(M.metrics({...p,age}).kcal));
const j={start_date:'2026-11-28',ingredients_confirmed:true};
assert.equal(M.journeyState(null,'2026-11-28').phase,'prepare');
assert.equal(M.journeyState({...j,ingredients_confirmed:false},'2026-11-29').phase,'prepare');
assert.equal(M.journeyState(j,'2026-11-27').phase,'waiting');
assert.equal(M.journeyState(j,'2026-11-28').day,1);
assert.equal(M.journeyState(j,'2026-12-18').day,21);
assert.equal(M.journeyState(j,'2026-12-19').phase,'done');
console.log('OK: preparação exige confirmação; desbloqueio no dia escolhido; dias 1–21 e encerramento.');
