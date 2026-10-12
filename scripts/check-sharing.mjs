import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const recipes = JSON.parse(await readFile(new URL('../data/recipes.json', import.meta.url)));
let count = 0;
for (const r of recipes) {
  for (const v of [null, ...(r.variants ?? [])]) {
    const path = `${r.slug}/${v ? `${v.id}/` : ''}`;
    const html = await readFile(new URL(`../dist/${path}index.html`, import.meta.url), 'utf8');
    const imagePath = `/social/${r.slug}${v ? `-${v.id}` : ''}.png`;
    assert.ok(html.includes(`property="og:image" content="https://recipes.chriswiki.com${imagePath}"`), path);
    assert.ok(html.includes(`property="og:url" content="https://recipes.chriswiki.com/${path}"`), path);
    assert.ok(html.includes('name="twitter:card" content="summary_large_image"'), path);
    assert.ok(html.includes(`rel="canonical" href="https://recipes.chriswiki.com/${r.family ?? r.slug}/"`), path);
    if (r.variants) {
      const checked = [...html.matchAll(/<input type="radio" name="variant"[^>]* checked[^>]*>/g)];
      assert.equal(checked.length, 1, path);
      assert.ok(checked[0][0].includes(`value="${v?.id ?? r.variants.find(v => v.default).id}"`), path);
    }
    const png = await readFile(new URL(`../dist${imagePath}`, import.meta.url));
    assert.equal(png.subarray(1,4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1200);
    assert.equal(png.readUInt32BE(20), 630);
    assert.ok(png.length < 1_000_000, imagePath);
    count++;
  }
}
console.log(`Verified ${count} static recipe share pages, default selections, canonical URLs, and preview images.`);
