import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scaleAmount, scaleText } from '../lib/scale.mjs';
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
 assert.equal(quesadilla.ingredients.find(([,name])=>name.startsWith('plain Greek'))[0],'300g');
 assert.equal(quesadilla.ingredients.find(([,name])=>name==='chili powder, for the sauce')[0],'1 tsp');
 assert.equal(quesadilla.unrecorded,undefined);
});
