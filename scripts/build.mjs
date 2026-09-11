import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';

const recipes = JSON.parse(await readFile(new URL('../data/recipes.json', import.meta.url)));
const shopping = JSON.parse(await readFile(new URL('../data/shopping.json', import.meta.url)));
const root = new URL('../dist/', import.meta.url);
const e = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => `$${value.toFixed(2)}`;
const total = shopping.items.reduce((sum, item) => sum + Math.round(item.price * 100), 0) / 100;
const budget = shopping.items.reduce((sum, item) => sum + (item.omitBudget ? 0 : Math.round((item.budgetPrice ?? item.price) * 100)), 0) / 100;

function page(title, description, path, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${e(title)} · chriswiki recipes</title><meta name="description" content="${e(description)}"><link rel="canonical" href="https://recipes.chriswiki.com${path}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="website"><link rel="stylesheet" href="/style.css"><script src="/app.js" defer></script></head>
<body><a class="skip" href="#main">Skip to content</a><div class="shell"><header><a class="brand" href="/">chriswiki<span> / recipes</span></a><nav aria-label="Main"><a href="/"${path === '/' ? ' aria-current="page"' : ''}>Recipes</a><a href="/shopping/"${path === '/shopping/' ? ' aria-current="page"' : ''}>Shopping list</a><a href="https://chriswiki.com">Main site ↗</a></nav></header><main id="main">${body}</main><footer><span>A personal recipe notebook.</span><a href="https://github.com/christianwilkins/recipes">View source ↗</a></footer></div></body></html>`;
}

await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await cp(new URL('../public/', import.meta.url), root, { recursive: true });
async function output(path, html) {
  const dir = new URL(path, root);
  await mkdir(dir, { recursive: true });
  await writeFile(new URL('index.html', dir), html);
}

await output('./', page('Recipes', 'Saved recipes, practical notes, and a shopping list for Polaris, Ohio.', '/', `
<section class="intro"><p class="eyebrow">The recipe notebook</p><h1>Good things<br>to make.</h1><p>Saved recipes, useful notes, and the ingredients to bring them together.</p></section>
<section aria-labelledby="desserts"><div class="section-title"><h2 id="desserts">Desserts</h2><span>2 recipes</span></div><div class="recipe-index">${recipes.map(r => `<article><p class="meta">${e(r.servings)} · No baking</p><h3><a href="/${r.slug}/">${e(r.title)} <span aria-hidden="true">↗</span></a></h3><p>${e(r.description)}</p><a class="text-link" href="/${r.slug}/">Make this recipe</a></article>`).join('')}</div></section>
<aside class="shopping-callout"><div><h2>One shop for both.</h2><p>Shared ingredients, a checklist, and budget swaps near Polaris.</p></div><a class="button" href="/shopping/">Open shopping list</a></aside>
<section class="archive"><h2>From the archive</h2><p>The original recipes from the repository.</p><div><a href="https://github.com/christianwilkins/recipes/blob/main/korean-beef-bowl.md">Korean beef bowl ↗</a><a href="https://github.com/christianwilkins/recipes/blob/main/mac-and-cheese.md">Three-ingredient mac and cheese ↗</a><a href="https://github.com/christianwilkins/recipes/blob/main/smoothie.md">Smoothie ↗</a></div></section>`));

for (const r of recipes) {
  await output(`${r.slug}/`, page(r.title, r.description, `/${r.slug}/`, `
<a class="back" href="/">← All recipes</a><section class="recipe-heading"><p class="eyebrow">Dessert · ${e(r.servings)}</p><h1>${e(r.title)}</h1><p>${e(r.description)}</p><p class="meta">${e(r.time)}</p><div class="actions"><a class="button" href="/shopping/">Shop ingredients</a><button class="secondary print" hidden>Print recipe</button><a href="${e(r.source)}">Prep with Drew’s reel ↗</a></div></section>
<div class="recipe-body"><section><h2>Ingredients</h2><p class="small">For ${e(r.servings)}. Tap to check off as you cook.</p><ul class="ingredients">${r.ingredients.map(([amount,name], i) => `<li><label><input type="checkbox" data-check="${r.slug}-${i}"><span><strong>${e(amount)}</strong> ${e(name)}</span></label></li>`).join('')}</ul></section><section><h2>Method</h2><ol class="steps">${r.steps.map(s => `<li>${e(s)}</li>`).join('')}</ol><p class="small">${e(r.methodNote)}</p><div class="notes"><h3>A few useful notes</h3>${r.notes.map(n => `<p>${e(n)}</p>`).join('')}</div><p class="small nutrition">${e(r.nutrition)}</p></section></div>`));
}

const rows = shopping.items.map(item => `<li class="shopping-item" data-id="${item.id}" data-price="${item.price}"${item.omitBudget ? ' data-omit-budget="true"' : ''}${item.budgetPrice ? ` data-budget-price="${item.budgetPrice}"` : ''}>
<label><input type="checkbox" data-check="shop-${item.id}"><span class="item-copy"><strong>${e(item.name)}</strong><span>${e(item.needed)}</span></span></label><div class="purchase"><a href="${e(item.url)}" data-buy-original>${e(item.buy)} ↗</a>${item.budgetBuy ? `<a href="${e(item.budgetUrl)}" data-buy-budget hidden>${e(item.budgetBuy)} ↗</a>` : ''}<span class="price" data-display-price>${item.local ? '' : '~'}${money(item.price)}</span><span class="small" data-price-note>${item.local ? 'Local pickup checked' : 'Online estimate'}</span></div>${item.note ? `<p class="item-note">${e(item.note)}</p>` : ''}</li>`).join('');

await output('shopping/', page('Shopping list', 'A combined shopping checklist for protein banana pudding and a Biscoff cheesecake bowl near Polaris, Ohio.', '/shopping/', `
<a class="back" href="/">← All recipes</a><section class="shopping-heading"><p class="eyebrow">Polaris, Ohio · Checked ${shopping.checked}</p><h1>One shop.<br>Two dessert bowls.</h1><p>Enough for one banana pudding and one Biscoff cheesecake bowl. Prices are for full packages, with leftovers.</p></section>
<div class="shop-layout"><aside class="shop-summary"><h2>The basket</h2><p class="total" id="basket-total">${money(total)}</p><p class="small">Estimated cost of unchecked items. Excludes tax and fulfillment fees.</p><label class="budget-toggle" hidden><input type="checkbox" id="budget-mode"><span>Use budget swaps</span></label><p class="small">Skim milk; omit extra vanilla and monk fruit. Both baskets use store-brand wafers and Neufchâtel.</p><p class="small">Budget basket: ${money(budget)}. Already have whey? ${money(budget - shopping.items.find(i => i.id === 'whey').price)}.</p><div class="summary-actions"><button class="secondary" id="reset" hidden>Reset checklist</button><button class="secondary print" hidden>Print list</button></div><p class="small" id="list-status" role="status" aria-live="polite">0 items checked</p><p class="small">Check off what you have or have bought. Saved on this device.</p><noscript><p>The list works without JavaScript; automatic totals and saving need JavaScript enabled.</p></noscript></aside><section aria-label="Ingredients to buy"><ul class="shopping-items">${rows}</ul></section></div>
<section class="store-notes"><h2>Where to buy</h2><p><a href="${shopping.storeUrl}">${e(shopping.store)}</a><br>${e(shopping.address)}</p><p>A practical one-stop choice. Yogurt, whey, both pudding mixes, cookie butter, and vanilla had local pickup available when checked. Other prices are online estimates. Stock and prices can change; pickup and delivery fees depend on the order.</p><p><a href="https://www.aldi.us/store/aldi/products/20249671-friendly-farms-nonfat-plain-greek-yogurt-32-oz">ALDI’s yogurt was listed at $2.79</a>, and <a href="https://www.kroger.com/p/item/0004300020812">Kroger’s cheesecake pudding at $1.50</a>. Those listings were not verified for local pickup. The small savings may not justify another stop. <a href="https://www.target.com/b/biscoff/-/N-y6zaz">Target’s Biscoff listings</a> were slightly more expensive.</p><p class="small">Shopping research dated ${shopping.checked}. These are comparison links, not an order or a reservation. The basket is a practical low-cost option among the listings checked, not a guarantee of the lowest price everywhere.</p></section>`));
await writeFile(new URL('404.html', root), page('Page not found', 'Find a saved recipe.', '/404', '<section class="intro"><h1>That page is missing.</h1><p><a href="/">Back to the recipes</a></p></section>'));
await writeFile(new URL('robots.txt', root), 'User-agent: *\nAllow: /\nSitemap: https://recipes.chriswiki.com/sitemap.xml\n');
await writeFile(new URL('sitemap.xml', root), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', ...recipes.map(r=>`/${r.slug}/`), '/shopping/'].map(p=>`<url><loc>https://recipes.chriswiki.com${p}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${recipes.length} recipe pages, the index, shopping list, and 404 page.`);
