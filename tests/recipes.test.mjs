import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleAmount, scaleText, scaleFactors } from '../lib/scale.mjs';
import { recipeNutrition } from '../lib/nutrition.mjs';
import recipes from '../data/recipes.json' with { type: 'json' };
const recipe = slug => recipes.find(r => r.slug === slug);

test('amounts scale numbers, ranges, fractions, and count words',()=>{
 assert.equal(scaleAmount('1½ tbsp, plus ½–1 tsp more to taste',2),'3 tbsp, plus 1–2 tsp more to taste');
 assert.equal(scaleAmount('100–125g',1.5),'150–190g');
 assert.equal(scaleAmount('8 cans (15 oz each)',0.5),'4 cans (15 oz each)');
 assert.equal(scaleAmount('1 can / 15 oz',2),'2 cans / 30 oz');
 assert.equal(scaleAmount('8 skewers / 2 rice bowls',0.5),'4 skewers / 1 rice bowl');
 assert.equal(scaleAmount('To taste',3),'To taste');
 assert.equal(scaleText('Add {2 tbsp} vinegar and simmer 20–30 minutes at 425°F.',1.5),'Add 3 tbsp vinegar and simmer 20–30 minutes at 425°F.');
});

test('every braced quantity in recipe text scales cleanly',()=>{
 for(const r of recipes) for(const text of [...r.steps,...(r.variants??[]).flatMap(v=>v.steps),...(r.customization??[]).map(([,t])=>t)]) {
  assert.doesNotMatch(scaleText(text,2),/[{}]/,r.slug);
 }
});

test('flavors share one base amount at every supported batch size',()=>{
 for(const [slug,name,base] of [['greek-yogurt-pudding',/Greek yogurt/,200],['protein-overnight-oats',/^rolled oats$/,60]]) {
  for(const v of recipe(slug).variants) {
   const amount=v.ingredients.find(([,ingredient])=>name.test(ingredient))[0];
   for(const factor of scaleFactors) assert.equal(scaleAmount(amount,factor),`${base*factor}g`,`${slug}/${v.id}: ${factor}×`);
  }
 }
});

test('amounts round to practical kitchen measurements at every scale',()=>{
 assert.equal(scaleAmount('0.056 tsp',0.5),'a pinch');
 assert.equal(scaleAmount('245.5g',2),'490g');
 assert.equal(scaleAmount('⅛ tsp',0.5),'a pinch');
 assert.equal(scaleAmount('⅓ scoop',0.5),'⅛ scoop');
 assert.equal(scaleAmount('48.9g',1),'50g');
 assert.equal(scaleAmount('0.444 scoop',1),'½ scoop');
 assert.equal(scaleAmount('1.556 tsp',1),'1½ tsp');
 const banoffee=recipe('greek-yogurt-pudding').variants.find(v=>v.id==='banoffee-cheesecake');
 assert.match(scaleText(banoffee.steps[0],2),/60g.*35g/);
 const fairlife=recipe('greek-yogurt-pudding').variants.find(v=>v.id==='biscoff-fairlife');
 assert.match(scaleText(fairlife.notes[0],2),/5–8g/);
});

test('nutrition is per serving and stays consistent between dried and canned beans',()=>{
 const cuban=recipe('cuban-style-black-beans');
 const [dried,canned]=cuban.variants.map(v=>recipeNutrition(cuban,v));
 assert.ok(Math.abs(dried.perServing.calories-canned.perServing.calories)<40);
 assert.equal(Math.round(dried.batch.calories/14),Math.round(dried.perServing.calories));
 const quesadillas=recipe('quesadillas');
 const filling=recipeNutrition(quesadillas,quesadillas.variants[0]);
 assert.equal(filling.perServing,null);assert.match(filling.note,/tortillas/);
 assert.equal(recipeNutrition(recipe('chicken-satay-rice-bowls')),null);
});


test('family nutrition stays attached to its flavor and sauce source is complete',()=>{
 const pudding=recipe('greek-yogurt-pudding');
 assert.equal(recipeNutrition(pudding,pudding.variants[0]).perServing.calories,350);
 assert.equal(recipeNutrition(pudding,pudding.variants.find(v=>v.id==='ferrero-rocher')),null);
 const quesadilla=recipe('quesadillas');
 assert.equal(quesadilla.ingredients.find(([,name])=>name.startsWith('plain Greek'))[0],'150g');
 assert.equal(quesadilla.ingredients.find(([,name])=>name==='chili powder, for the sauce')[0],'½ tsp');
 assert.equal(quesadilla.unrecorded,undefined);
});
