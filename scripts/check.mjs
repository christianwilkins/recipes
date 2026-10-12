import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const recipes = JSON.parse(await readFile(new URL('../data/recipes.json', import.meta.url)));
const shopping = JSON.parse(await readFile(new URL('../data/shopping.json', import.meta.url)));
const trip = JSON.parse(await readFile(new URL('../data/trader-joes.json', import.meta.url)));
const tripItems = trip.groups.flatMap(group => group.items);
assert.equal(new Set(tripItems.map(item => item.id)).size, tripItems.length);
assert.equal(new Set(trip.groups.map(group => group.id)).size, trip.groups.length);
for (const group of trip.groups) {
  assert.ok(group.id && group.title && group.items.length);
  for (const item of group.items) {
    assert.ok(item.id && item.name && item.quantity);
    if (item.url) assert.equal(new URL(item.url).protocol, 'https:');
  }
}
assert.equal(new Set(recipes.map(r=>r.slug)).size, recipes.length);
assert.equal(new Set(shopping.items.map(i=>i.id)).size, shopping.items.length);
for (const r of recipes) {
  assert.match(r.slug, /^[a-z0-9-]+$/);
  assert.ok(r.title && r.ingredients.length && r.steps.length);
  if (r.source) assert.equal(new URL(r.source).hostname, 'www.instagram.com');
  if (r.shoppingPath) assert.ok(['/shopping/', '/trader-joes/'].includes(r.shoppingPath));
  if (r.variants) {
    assert.equal(r.variants.filter(v => v.default).length, 1);
    assert.equal(new Set(r.variants.map(v => v.id)).size, r.variants.length);
    for (const v of r.variants) {
      assert.match(v.id, /^[a-z0-9-]+$/);
      assert.ok(v.label && v.ingredients.length && v.steps.length);
      if (v.link) assert.ok(recipes.some(other => other.slug === v.link.slug));
    }
  }
  const foods = JSON.parse(await readFile(new URL('../data/nutrition.json', import.meta.url))).foods;
  for (const [, , map] of [...r.ingredients, ...(r.variants ?? []).flatMap(v => v.ingredients)]) {
    if (map) assert.ok(foods[map.food] && map.g > 0, `${r.slug}: ${map.food}`);
  }
  if (r.nutritionEstimate) assert.ok(r.nutritionServings?.count > 0);
  for (const x of r.related ?? []) {
    const target = recipes.find(other => other.slug === x.slug);
    assert.ok(target && x.text && x.note);
    if (x.variant) assert.ok(target.variants?.some(v => v.id === x.variant));
  }
}
for (const item of shopping.items) {
  assert.ok(item.name && item.buy && item.needed);
  assert.ok(Number.isFinite(item.price) && item.price >= 0);
  assert.equal(new URL(item.url).protocol, 'https:');
}
assert.equal(shopping.items.reduce((n,i)=>n+Math.round(i.price*100),0), 5669);
assert.equal(shopping.items.reduce((n,i)=>n+(i.omitBudget?0:Math.round((i.budgetPrice??i.price)*100)),0), 4150);
console.log('Recipe records, shopping links, and basket totals are valid.');
