import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadShareCards, verifyShareAssets} from '../lib/share-cards.mjs';
const shareCards = await loadShareCards();
const versions = await verifyShareAssets(shareCards);
const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for (const card of shareCards.cards) {
  const html = await readFile(new URL(`../dist${card.path}index.html`, import.meta.url), 'utf8');
  const image = `${shareCards.template.origin}${card.image}?v=${versions[card.image]}`;
  for (const [name, value] of [['og:title', card.title], ['og:image', image], ['og:url', `${shareCards.template.origin}${card.path}`], ['og:image:width', String(shareCards.template.width)], ['og:image:height', String(shareCards.template.height)], ['og:image:alt', `${card.title} — ${shareCards.template.signature}`]]) {
    assert.ok(html.includes(`property="${name}" content="${escape(value)}"`), `${card.path}: ${name}`);
  }
  assert.ok(html.includes(`name="twitter:title" content="${escape(card.title)}"`), card.path);
  assert.ok(html.includes(`name="twitter:image" content="${escape(image)}"`), card.path);
}
const recipes = JSON.parse(await readFile(new URL('../data/recipes.json', import.meta.url)));
let count = 0;
for (const r of recipes) {
  for (const v of [null, ...(r.variants ?? [])]) {
    const path = `${r.slug}/${v ? `${v.id}/` : ''}`;
    const html = await readFile(new URL(`../dist/${path}index.html`, import.meta.url), 'utf8');
    const imagePath = `/social/${r.slug}${v ? `-${v.id}` : ''}.png`;
    const png = await readFile(new URL(`../dist${imagePath}`, import.meta.url));
    const version = createHash("sha256").update(png).digest("hex").slice(0,12);
    assert.ok(html.includes(`property="og:image" content="https://recipes.chriswiki.com${imagePath}?v=${version}"`), path);
    assert.ok(html.includes(`property="og:url" content="https://recipes.chriswiki.com/${path}"`), path);
    assert.ok(html.includes('name="twitter:card" content="summary_large_image"'), path);
    assert.ok(html.includes(`rel="canonical" href="https://recipes.chriswiki.com/${r.family ?? r.slug}/"`), path);
    if (r.variants) {
      const checked = [...html.matchAll(/<input type="radio" name="variant"[^>]* checked[^>]*>/g)];
      assert.equal(checked.length, 1, path);
      assert.ok(checked[0][0].includes(`value="${v?.id ?? r.variants.find(v => v.default).id}"`), path);
    }
    assert.equal(png.subarray(1,4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), shareCards.template.width);
    assert.equal(png.readUInt32BE(20), shareCards.template.height);
    assert.ok(png.length < 1_000_000, imagePath);
    count++;
  }
}
console.log(`Verified ${shareCards.cards.length} share cards and metadata, plus ${count} recipe selections and canonical URLs.`);
