import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { categories } from '../lib/groceries.mjs';

const recipes = JSON.parse(await readFile(new URL('../data/recipes.json', import.meta.url)));
const root = new URL('../dist/', import.meta.url);
const assets = {};
for (const name of ['style.css', 'app.js', 'groceries.js']) {
  const content = await readFile(new URL(`../public/${name}`, import.meta.url));
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
  assets[name] = { content, filename: name.replace(/(\.[^.]+)$/, `.${hash}$1`) };
}
const assetUrl = name => `/${assets[name].filename}`;
const e = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function page(title, description, path, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${e(title)} · chriswiki recipes</title><meta name="description" content="${e(description)}"><link rel="canonical" href="https://recipes.chriswiki.com${path}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="website"><link rel="stylesheet" href="${assetUrl('style.css')}"><script src="${assetUrl('app.js')}" defer></script>${path === '/shopping/' ? `<script src="${assetUrl('groceries.js')}" defer></script>` : ''}</head>
<body><a class="skip" href="#main">Skip to content</a><div class="shell"><header><a class="brand" href="/">chriswiki<span> / recipes</span></a><nav aria-label="Main"><a href="/"${path === '/' ? ' aria-current="page"' : ''}>Recipes</a><a href="/shopping/"${path === '/shopping/' ? ' aria-current="page"' : ''}>Grocery list</a><a href="https://chriswiki.com">Main site ↗</a></nav></header><main id="main">${body}</main><footer><span>A personal recipe notebook.</span><a href="https://github.com/christianwilkins/recipes">View source ↗</a></footer></div></body></html>`;
}
const addButton = r => `<button class="secondary" data-add-recipe="${e(r.slug)}" hidden>Add ingredients</button>`;
await rm(root, {recursive:true, force:true});
await mkdir(root, {recursive:true});
await cp(new URL('../public/', import.meta.url), root, {recursive:true});
for (const {content, filename} of Object.values(assets)) await writeFile(new URL(filename, root), content);
async function output(path, html) {
  const dir = new URL(path, root);
  await mkdir(dir, {recursive:true});
  await writeFile(new URL('index.html', dir), html);
}
await output('./', page('Recipes', 'Public recipes and one shared grocery list.', '/', `
<section class="intro"><h1>Good things<br>to make.</h1><p>Choose a recipe. Add its ingredients to the shared grocery list, then make it your own.</p><a class="text-link" href="/shopping/">Open the grocery list</a><p class="action-status small" role="status" aria-live="polite"></p></section>
${[['Dinner','dinners','Dinners'], ['Dessert','desserts','Desserts'], ['Side dish','side-dishes','Side dishes']].map(([category,id,title]) => {
 const entries = recipes.filter(r => (r.category ?? 'Dessert') === category);
 if (!entries.length) return '';
 return `<section aria-labelledby="${id}"><div class="section-title"><h2 id="${id}">${title}</h2><span>${entries.length} ${entries.length === 1 ? 'recipe' : 'recipes'}</span></div><div class="recipe-index">${entries.map(r=>`<article><p class="meta">${e(r.servings)}</p><h3><a href="/${r.slug}/">${e(r.title)}</a></h3><p>${e(r.description)}</p><div class="actions"><a class="text-link" href="/${r.slug}/">Make this recipe</a>${addButton(r)}</div><p class="recipe-add-status small" role="status" aria-live="polite"></p></article>`).join('')}</div></section>`;
}).join('')}
<section class="archive"><h2>From the archive</h2><p>The original recipes from the repository.</p><div><a href="https://github.com/christianwilkins/recipes/blob/main/korean-beef-bowl.md">Korean beef bowl ↗</a><a href="https://github.com/christianwilkins/recipes/blob/main/mac-and-cheese.md">Three-ingredient mac and cheese ↗</a><a href="https://github.com/christianwilkins/recipes/blob/main/smoothie.md">Smoothie ↗</a></div></section>`));
for (const r of recipes) {
 await output(`${r.slug}/`, page(r.title,r.description,`/${r.slug}/`,`
<a class="back" href="/">← All recipes</a><section class="recipe-heading"><h1>${e(r.title)}</h1><p>${e(r.description)}</p><p class="meta">${e(r.servings)} · ${e(r.time)}</p><div class="actions">${addButton(r)}<a href="/shopping/">View grocery list</a><button class="secondary print" hidden>Print recipe</button>${r.source ? `<a href="${e(r.source)}">${e(r.sourceLabel ?? 'Prep with Drew’s reel')} ↗</a>` : ''}</div><p class="action-status small" role="status" aria-live="polite"></p></section>
<div class="recipe-body"><section><h2>Ingredients</h2><p class="small">For ${e(r.servings)}. Check off as you cook.</p><ul class="ingredients">${r.ingredients.map(([amount,name],i)=>`<li><label><input type="checkbox" data-check="${r.slug}-${i}"><span><strong>${e(amount)}</strong> ${e(name)}</span></label></li>`).join('')}</ul></section><section><h2>Method</h2><ol class="steps">${r.steps.map(s=>`<li>${e(s)}</li>`).join('')}</ol>${r.methodNote ? `<p class="small">${e(r.methodNote)}</p>` : ''}<div class="notes"><h3>A few useful notes</h3>${r.notes.map(n=>`<p>${e(n)}</p>`).join('')}</div>${r.nutrition ? `<p class="small nutrition">${e(r.nutrition)}</p>` : ''}</section></div>`));
}
await output('shopping/', page('Grocery list', 'One shared grocery list. Add ingredients from recipes, add your own items, and edit from any device.', '/shopping/', `
<section class="shopping-heading"><h1>Grocery list.</h1><p>One list for the next shop. Anyone with this page can edit it; changes are shared across devices.</p></section>
<form id="add-item" class="grocery-add"><div class="field"><label for="item-name">Add an item</label><input id="item-name" name="name" maxlength="140" placeholder="e.g. Greek yogurt" required autocomplete="off"></div><div class="field"><label for="item-quantity">Buy quantity</label><input id="item-quantity" name="quantity" maxlength="180" placeholder="e.g. 2 tubs" autocomplete="off"></div><div class="field"><label for="item-category">Category</label><select id="item-category" name="category">${categories.map(c=>`<option${c==='Other'?' selected':''}>${e(c)}</option>`).join('')}</select></div><button class="button" type="submit">Add item</button></form>
<div class="grocery-toolbar"><p id="grocery-count" class="small">Loading the shared list…</p><div><button id="refresh-list" class="secondary" type="button">Refresh</button><button class="secondary print" hidden>Print list</button></div></div>
<div class="grocery-feedback"><p id="grocery-status" role="status" aria-live="polite"></p><button id="undo-remove" class="secondary" hidden>Undo remove</button></div>
<div id="grocery-list" aria-busy="true"></div><noscript><p>This shared list needs JavaScript to load and save changes. Recipes can still be read without it.</p></noscript>
<section class="grocery-help"><h2>Cooking something?</h2><p><a href="/">Browse the recipes</a> and use “Add ingredients.” Matching ingredients share one row, with each recipe’s amounts listed underneath. Set the buy quantity to the amount or package size you want. Adding a recipe again keeps one copy of its ingredients.</p><p class="small">The starting list includes the Trader Joe’s groceries, freezer meals, and skincare. Product availability and prices may vary. Tap water is left out of recipe additions.</p></section>`));
await output('trader-joes/',page('Grocery list','The grocery list is now shared.','/shopping/','<section class="intro"><h1>One shared list.</h1><p><a href="/shopping/">Open the grocery list</a></p></section>'));
await writeFile(new URL('_redirects',root),'/trader-joes /shopping/ 301\n/trader-joes/ /shopping/ 301\n');
await writeFile(new URL('_routes.json',root),JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
await writeFile(new URL('404.html',root),page('Page not found','Find a saved recipe.','/404','<section class="intro"><h1>That page is missing.</h1><p><a href="/">Back to the recipes</a></p></section>'));
await writeFile(new URL('robots.txt',root),'User-agent: *\nAllow: /\nSitemap: https://recipes.chriswiki.com/sitemap.xml\n');
await writeFile(new URL('sitemap.xml',root),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/',...recipes.map(r=>`/${r.slug}/`),'/shopping/'].map(p=>`<url><loc>https://recipes.chriswiki.com${p}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${recipes.length} public recipes and the shared grocery list.`);
