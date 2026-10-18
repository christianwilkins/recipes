import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { handleGroceries, readList } from '../lib/groceries.mjs';
const schema = await readFile(new URL('../migrations/0001_groceries.sql', import.meta.url),'utf8');
const seed = await readFile(new URL('../migrations/0002_initial_list.sql', import.meta.url),'utf8');
function database() {
 const sqlite = new DatabaseSync(':memory:'); sqlite.exec(schema); sqlite.exec(seed);
 const wrap = (sql,params=[]) => ({bind(...args){return wrap(sql,args);}, async first(){return sqlite.prepare(sql).get(...params) ?? null;}, async all(){return {results:sqlite.prepare(sql).all(...params)};}, async run(){return sqlite.prepare(sql).run(...params);}, sql, params});
 return {sqlite,prepare:wrap,async batch(statements){sqlite.exec('BEGIN');try{const out=statements.map(s=>({results:sqlite.prepare(s.sql).all(...s.params)}));sqlite.exec('COMMIT');return out;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
async function request(db,path='',method='GET',body,origin) {
 const headers = body ? {'Content-Type':'application/json'} : {};
 if(origin) headers.Origin=origin;
 const response=await handleGroceries(new Request('https://recipes.chriswiki.com/api/groceries'+path,{method,headers,body:body?JSON.stringify(body):undefined}),db);
 return {status:response.status,...await response.json()};
}
test('seed loads once and recipe adds are idempotent with shared quantities retained',async()=>{
 const db=database(); const initial=await readList(db); assert.equal(initial.length,31);
 const added=await request(db,'/recipe','POST',{slug:'chicken-satay-rice-bowls'}); assert.equal(added.status,200);
 const repeated=await request(db,'/recipe','POST',{slug:'chicken-satay-rice-bowls'}); assert.equal(repeated.items.length,added.items.length);
 const coconut=repeated.items.find(i=>i.name==='Coconut milk'); assert.equal(coconut.quantity,'1 can');assert.equal(coconut.sources.length,1);assert.match(coconut.sources[0].amount,/50ml.*1 tbsp/);
 assert.equal(repeated.items.filter(i=>i.name==='Limes').length,1);
 assert.ok(!repeated.items.some(i=>/^(hot )?water$/i.test(i.name)));
});
test('all published recipes can be added, including shared dessert ingredients',async()=>{
 const db=database();
 for(const slug of ['protein-banana-pudding','biscoff-protein-cheesecake-bowl','cuban-style-black-beans','beef-stuffed-sweet-potatoes','chicken-satay-rice-bowls','quesadillas']) assert.equal((await request(db,'/recipe','POST',{slug})).status,200);
 const list=await readList(db); const yogurt=list.filter(i=>i.name==='Plain Greek yogurt');assert.equal(yogurt.length,1);assert.equal(yogurt[0].sources.length,4);
 assert.ok(list.find(i=>i.name==='Dried black beans'));assert.ok(list.find(i=>i.name==='Canned black beans'));
});
test('recipe variants add their own filling and share the base ingredients',async()=>{
 const db=database();
 const chicken=await request(db,'/recipe','POST',{slug:'quesadillas'});assert.equal(chicken.status,200);
 const filling=chicken.items.find(i=>i.name==='Cooked chipotle chicken');assert.match(filling.sources[0].title,/\(chipotle chicken\)/);assert.match(filling.sources[0].amount,/200–250g/);
 assert.ok(chicken.items.some(i=>/^smoked paprika$/i.test(i.name)));
 const beans=await request(db,'/recipe','POST',{slug:'quesadillas',variant:'black-bean'});assert.equal(beans.status,200);
 const canned=beans.items.find(i=>i.name==='Canned black beans');assert.match(canned.sources[0].title,/\(black bean\)/);assert.match(canned.sources[0].amount,/Cuban-style black beans, or canned/);
 assert.ok(beans.items.find(i=>/^smoked paprika$/i.test(i.name)));assert.ok(!beans.items.some(i=>/^water/i.test(i.name)));
 for(const name of ['Tortillas','Shredded cheese','Plain Greek yogurt','Jalapeños']){const rows=beans.items.filter(i=>i.name===name);assert.equal(rows.length,1);assert.equal(rows[0].sources.length,1);assert.doesNotMatch(rows[0].sources[0].title,/\(/);}
 assert.equal((await request(db,'/recipe','POST',{slug:'quesadillas',variant:'tofu'})).status,404);
 assert.equal((await request(db,'/recipe','POST',{slug:'quesadillas',variant:7})).status,400);
 assert.equal((await request(db,'/recipe','POST',{slug:'cuban-style-black-beans',variant:'black-bean'})).status,404);
});
test('batch size scales grocery amounts and a re-add updates them',async()=>{
 const db=database();
 const doubled=await request(db,'/recipe','POST',{slug:'cuban-style-black-beans',variant:'canned',scale:2});assert.equal(doubled.status,200);
 let beans=doubled.items.find(i=>i.name==='Canned black beans');assert.match(beans.sources[0].amount,/^16 cans \(15 oz each\)/);assert.match(beans.sources[0].title,/canned beans, 2× batch/);
 const single=await request(db,'/recipe','POST',{slug:'cuban-style-black-beans',variant:'canned'});
 beans=single.items.find(i=>i.name==='Canned black beans');assert.equal(beans.sources.length,1);assert.match(beans.sources[0].amount,/^8 cans/);
 const dried=await request(db,'/recipe','POST',{slug:'cuban-style-black-beans',scale:0.5});
 assert.match(dried.items.find(i=>i.name==='Dried black beans').sources[0].amount,/^1 lb/);
 assert.equal((await request(db,'/recipe','POST',{slug:'cuban-style-black-beans',scale:7})).status,400);
 assert.equal((await request(db,'/recipe','POST',{slug:'cuban-style-black-beans',scale:'2'})).status,400);
});
test('independent edits preserve other fields; remove and undo preserve requirements',async()=>{
 const db=database();await request(db,'/recipe','POST',{slug:'chicken-satay-rice-bowls'});
 const item=(await readList(db)).find(i=>i.name==='Coconut milk');
 await Promise.all([request(db,`/${item.id}`,'PATCH',{quantity:'2 cans'}),request(db,`/${item.id}`,'PATCH',{checked:true})]);
 let current=(await readList(db)).find(i=>i.id===item.id);assert.equal(current.quantity,'2 cans');assert.equal(current.checked,true);
 await request(db,`/${item.id}`,'DELETE');assert.ok(!(await readList(db)).some(i=>i.id===item.id));
 await request(db,`/${item.id}`,'PATCH',{deleted:false});current=(await readList(db)).find(i=>i.id===item.id);assert.equal(current.quantity,'2 cans');assert.equal(current.sources.length,1);
});
test('custom item edits, duplicate names, input limits, and origin checks',async()=>{
 const db=database();
 const added=await request(db,'','POST',{name:'Coffee',quantity:'1 bag',category:'Rice, beans, and pantry'});assert.equal(added.status,201);
 assert.equal((await request(db,'','POST',{name:'coffee',category:'Other'})).status,409);
 assert.equal((await request(db,'','POST',{name:'x'.repeat(141),category:'Other'})).status,400);
 assert.equal((await request(db,'','POST',{name:'Tea',category:'Other'},'https://elsewhere.example')).status,403);
 assert.equal((await request(db,'/recipe','POST',{slug:'unknown'})).status,404);
 const item=added.items.find(i=>i.name==='Coffee');
 assert.equal((await request(db,`/${item.id}`,'PATCH',{name:'Coffee beans',note:'Decaf'})).status,200);
 assert.equal((await request(db,`/${item.id}`,'PATCH',{name:'Coconut milk'})).status,409);
});
test('recipe addition rolls back fully when the list capacity is reached',async()=>{
 const db=database();
 for(let i=31;i<299;i++) db.sqlite.prepare('INSERT INTO groceries (item_key,name) VALUES (?,?)').run(`extra-${i}`,`Extra ${i}`);
 const before=await readList(db);
 const result=await request(db,'/recipe','POST',{slug:'cuban-style-black-beans'});assert.equal(result.status,409);
 assert.deepEqual(await readList(db),before);
});


test('family variants preserve exact quantities, independent flavors, and scaled re-adds',async()=>{
 const db=database();
 const add=await request(db,'/recipe','POST',{slug:'protein-overnight-oats',variant:'pb-and-j',scale:2});
 assert.equal(add.status,200);
 const yogurt=add.items.find(i=>i.name==='Plain Greek yogurt');
 assert.equal(yogurt.sources[0].amount,'400g plain Greek yogurt');
 assert.equal(yogurt.sources[0].slug,'protein-overnight-oats/?flavor=pb-and-j');
 const repeat=await request(db,'/recipe','POST',{slug:'protein-overnight-oats',variant:'pb-and-j'});
 assert.equal(repeat.items.length,add.items.length);
 assert.equal(repeat.items.find(i=>i.name==='Plain Greek yogurt').sources[0].amount,'200g plain Greek yogurt');
 await request(db,'/recipe','POST',{slug:'protein-overnight-oats',variant:'plain'});
 await request(db,'/recipe','POST',{slug:'greek-yogurt-pudding',variant:'ferrero-rocher'});
 const list=await readList(db);
 assert.equal(list.find(i=>i.name==='Plain Greek yogurt').sources.length,3);
 for(const name of ['Vanilla whey protein','Chocolate whey protein','Chocolate-peanut whey protein']) assert.ok(list.some(i=>i.name===name),name);
 assert.equal((await request(db,'/recipe','POST',{slug:'protein-overnight-oats',variant:'missing'})).status,404);
});
test('every family variant adds only its own ingredients',async()=>{
 const recipes=JSON.parse(await readFile(new URL('../data/recipes.json',import.meta.url)));
 for(const r of recipes.filter(r=>r.familyVariants)) for(const v of r.variants){
  const result=await request(database(),'/recipe','POST',{slug:r.slug,variant:v.id});
  assert.equal(result.status,200);
  assert.ok(result.items.flatMap(i=>i.sources).every(s=>s.slug===`${r.slug}/?flavor=${v.id}`));
 }
});
