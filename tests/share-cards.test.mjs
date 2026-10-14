import test from 'node:test';
import assert from 'node:assert/strict';
import { recipeCards, loadShareCards, shareSourceHash, verifyShareAssets } from '../lib/share-cards.mjs';

test('new recipes and variants receive cards without renderer changes', () => {
  const cards = recipeCards([{slug:'test-soup', title:'Soup', variants:[{id:'tomato', label:'Tomato'}]}]);
  assert.deepEqual(cards, [
    {id:'test-soup', path:'/test-soup/', title:'Soup'},
    {id:'test-soup-tomato', path:'/test-soup/tomato/', title:'Tomato · Soup'}
  ]);
  const customized = recipeCards([{slug:'test', title:'Full title', shareTitle:'Short title', shareVariantSuffix:'soup', variants:[{id:'a', label:'Tomato'}, {id:'b', label:'Long label', shareTitle:'Custom soup'}]}]);
  assert.deepEqual(customized.map(card => card.title), ['Short title', 'Tomato soup', 'Custom soup']);
});

test('published assets match their source and title or style edits require regeneration', async () => {
  const input = await loadShareCards();
  const versions = await verifyShareAssets(input);
  assert.equal(Object.keys(versions).length, input.cards.length);
  const updated = structuredClone(input);
  updated.cards[0].title = 'Changed title';
  assert.notEqual(await shareSourceHash(updated), await shareSourceHash(input));
  await assert.rejects(verifyShareAssets(updated), /Share cards are stale/);
  const restyled = structuredClone(input);
  restyled.template.padding += 8;
  await assert.rejects(verifyShareAssets(restyled), /Share cards are stale/);
});
