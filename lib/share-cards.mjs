import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const hash = value => createHash('sha256').update(value).digest('hex');

export function recipeCards(recipes) {
  return recipes.flatMap(recipe => {
    const title = recipe.shareTitle ?? recipe.title;
    return [
      {id: recipe.slug, path: `/${recipe.slug}/`, title},
      ...(recipe.variants ?? []).map(variant => ({
        id: `${recipe.slug}-${variant.id}`,
        path: `/${recipe.slug}/${variant.id}/`,
        title: variant.shareTitle ?? (recipe.shareVariantSuffix ? `${variant.label} ${recipe.shareVariantSuffix}` : `${variant.label} · ${title}`)
      }))
    ];
  });
}

export async function loadShareCards() {
  const template = JSON.parse(await read('data/share-template.json'));
  const recipes = JSON.parse(await read('data/recipes.json'));
  const css = (await read('public/style.css')).toString();
  const dark = css.split('@media(prefers-color-scheme:dark)')[1]?.split('}}')[0];
  assert.ok(dark, 'Missing dark theme');
  template.colors = Object.fromEntries(['bg', 'fg', 'muted'].map(name => {
    const match = dark.match(new RegExp(`--${name}:oklch\\(([\\d.]+) 0 0\\)`));
    assert.ok(match, `Missing neutral dark theme token: ${name}`);
    const linear = Number(match[1]) ** 3;
    const channel = Math.round(255 * (linear <= .0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - .055));
    return [name, [channel, channel, channel]];
  }));
  const cards = [...template.pages, ...recipeCards(recipes)];
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length, 'Duplicate card IDs');
  assert.equal(new Set(cards.map(card => card.path)).size, cards.length, 'Duplicate card paths');
  for (const card of cards) {
    assert.match(card.id, /^[a-z0-9-]+$/);
    assert.ok(typeof card.title === 'string' && card.title.trim(), `Missing title: ${card.id}`);
    card.image = `/social/${card.id}.png`;
  }
  return {template, cards};
}

export async function shareSourceHash(input) {
  const files = ['scripts/generate-share-images.py', input.template.serif, input.template.sans];
  return hash(JSON.stringify({input, files: await Promise.all(files.map(async path => [path, hash(await read(path))]))}));
}

export async function verifyShareAssets(input) {
  const generated = JSON.parse(await read('data/share-assets.json'));
  assert.equal(generated.sourceHash, await shareSourceHash(input), 'Share cards are stale. Run npm run share:images');
  const expected = input.cards.map(card => `${card.id}.png`).sort();
  const actual = (await readdir(new URL('public/social/', root))).filter(name => name.endsWith('.png')).sort();
  assert.deepEqual(actual, expected, 'Missing or orphaned share images');
  const versions = {};
  for (const card of input.cards) {
    const png = await read(`public${card.image}`);
    assert.equal(hash(png), generated.images[card.id], `Changed share image: ${card.id}. Run npm run share:images`);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), input.template.width);
    assert.equal(png.readUInt32BE(20), input.template.height);
    assert.ok(png.length < 1_000_000, `Oversized share image: ${card.id}`);
    versions[card.image] = hash(png).slice(0, 12);
  }
  return versions;
}
