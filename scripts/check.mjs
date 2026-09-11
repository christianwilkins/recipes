import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const recipes = JSON.parse(await readFile(new URL('../data/recipes.json', import.meta.url)));
const shopping = JSON.parse(await readFile(new URL('../data/shopping.json', import.meta.url)));
assert.equal(new Set(recipes.map(r=>r.slug)).size, recipes.length);
assert.equal(new Set(shopping.items.map(i=>i.id)).size, shopping.items.length);
for (const r of recipes) {
  assert.match(r.slug, /^[a-z0-9-]+$/);
  assert.ok(r.title && r.ingredients.length && r.steps.length);
  assert.equal(new URL(r.source).hostname, 'www.instagram.com');
}
for (const item of shopping.items) {
  assert.ok(item.name && item.buy && item.needed);
  assert.ok(Number.isFinite(item.price) && item.price >= 0);
  assert.equal(new URL(item.url).protocol, 'https:');
}
assert.equal(shopping.items.reduce((n,i)=>n+Math.round(i.price*100),0), 5669);
assert.equal(shopping.items.reduce((n,i)=>n+(i.omitBudget?0:Math.round((i.budgetPrice??i.price)*100)),0), 4150);
console.log('Recipe records, shopping links, and basket totals are valid.');
