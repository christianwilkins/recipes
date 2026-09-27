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
 for(const slug of ['protein-banana-pudding','biscoff-protein-cheesecake-bowl','cuban-style-black-beans','beef-stuffed-sweet-potatoes','chicken-satay-rice-bowls']) assert.equal((await request(db,'/recipe','POST',{slug})).status,200);
 const list=await readList(db); const yogurt=list.filter(i=>i.name==='Plain Greek yogurt');assert.equal(yogurt.length,1);assert.equal(yogurt[0].sources.length,3);
 assert.ok(list.find(i=>i.name==='Dried black beans'));assert.ok(list.find(i=>i.name==='Canned black beans'));
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
