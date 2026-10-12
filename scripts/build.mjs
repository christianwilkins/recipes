import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { categories } from '../lib/groceries.mjs';
import { scaleFactors, scaleText } from '../lib/scale.mjs';
import { recipeNutrition, nutrients } from '../lib/nutrition.mjs';

const recipes = JSON.parse(await readFile(new URL('../data/recipes.json', import.meta.url)));
const root = new URL('../dist/', import.meta.url);
// The browser bundle includes the same scaling code the build and grocery API use.
const scaleSource = (await readFile(new URL('../lib/scale.mjs', import.meta.url), 'utf8')).replace(/^export /gm, '');
const sources = {
  'style.css': await readFile(new URL('../public/style.css', import.meta.url)),
  'app.js': `${scaleSource}\n${await readFile(new URL('../public/app.js', import.meta.url), 'utf8')}`,
  'groceries.js': await readFile(new URL('../public/groceries.js', import.meta.url))
};
const assets = {};
for (const [name, content] of Object.entries(sources)) {
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
  assets[name] = { content, filename: name.replace(/(\.[^.]+)$/, `.${hash}$1`) };
}
const assetUrl = name => `/${assets[name].filename}`;
const e = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Same font files as chriswiki.com, so the subdomain reads as part of the main site.
const fonts = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&display=swap';
function page(title, description, path, body, head = '') {
  const current = href => path === href ? ' aria-current="page"' : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><title>${e(title)} · Christian Wilkins</title><meta name="description" content="${e(description)}"><link rel="canonical" href="https://recipes.chriswiki.com${path}"><meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="website"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fonts}"><link rel="stylesheet" href="${assetUrl('style.css')}"><script src="${assetUrl('app.js')}" defer></script>${path === '/shopping/' ? `<script src="${assetUrl('groceries.js')}" defer></script>` : ''}${head}</head>
<body><a class="skip" href="#main">Skip to content</a><header class="site-header"><div class="header-inner"><p class="brand"><a class="brand-name" href="https://chriswiki.com">Christian Wilkins</a><span class="brand-role">Recipes</span></p><nav aria-label="Recipes"><a href="/"${current('/')}>Recipes</a><a href="/shopping/"${current('/shopping/')}>Grocery list</a><a href="https://chriswiki.com">Main site <span aria-hidden="true">↗</span></a></nav></div></header><main id="main" class="content">${body}</main><footer class="site-footer"><p>A recipe notebook by <a href="https://chriswiki.com">Christian Wilkins</a>.</p><p><a href="https://chriswiki.com/lab">Fun Stuff</a><a href="https://github.com/christianwilkins/recipes">View source</a></p></footer></body></html>`;
}

// Recipes with variants share base ingredients and steps; each variant adds its own rows first.
const variantName = v => `${v.label}${v.vegetarian ? ' (vegetarian)' : ''}`;
const variantPath = (r, id) => `/${r.slug}/${id && !r.variants?.find(v => v.id === id)?.default ? `?${r.variantParam}=${encodeURIComponent(id)}` : ''}`;
const ingredientsFor = (r, v) => [...(v?.ingredients ?? []), ...r.ingredients];
const stepsFor = (r, v) => [...(v?.steps ?? []), ...r.steps];
const relatedPath = x => variantPath(recipes.find(r => r.slug === x.slug), x.variant);
const plain = text => scaleText(text, 1);
// Quantities are marked with braces in recipe text; the browser rescales elements that carry data-qty.
const qty = text => scaleText(e(text), 1, (amount, base) => `<span data-qty="${base}">${amount}</span>`);
const factorLabel = f => `${{0.5:'½', 1.5:'1½'}[f] ?? f}×`;

// The prompt template keeps the brace marks so the copied text follows the selected batch size.
function promptTemplate(r, v) {
  return [
    'Help me make this recipe. Ask how many servings I want and whether I need ingredient substitutions. Then scale the quantities if needed, help me identify groceries I am missing, and guide me through the cooking steps. Preserve the recipe notes and label any changes you suggest.',
    '', r.title, r.description, ...(v ? [`${r.variantLegend}: ${variantName(v)}`] : []), 'Batch: 1×', `Servings: {${r.servings}}`, `Time: ${v?.time ?? r.time}`,
    '', 'Ingredients', ...ingredientsFor(r, v).map(([amount, name]) => `- {${amount}} ${name}`),
    ...(v?.link ? ['', `${v.link.text} ${v.link.note} https://recipes.chriswiki.com/${v.link.slug}/`] : []),
    ...(r.unrecorded ? ['', `Not recorded in the source recipe: ${r.unrecorded.join('; ')}. Ask me about these instead of assuming amounts.`] : []),
    '', 'Method', ...stepsFor(r, v).map((step, i) => `${i + 1}. ${step}`),
    ...(r.methodNote ? ['', r.methodNote] : []),
    ...(r.notes.length ? ['', 'Notes', ...r.notes.map(note => `- ${note}`)] : []),
    ...(r.customization ? ['', 'Recipe variations and customization', ...r.customization.map(([title, text]) => `- ${title}: ${text}`)] : []),
    ...(r.related ? ['', 'Use it in', ...r.related.map(x => `- ${x.text}: https://recipes.chriswiki.com${relatedPath(x)} ${x.note}`)] : []),
    ...nutritionLines(r, v),
    '', `Recipe: https://recipes.chriswiki.com${variantPath(r, v?.id)}`,
    ...(r.source ? [`Original source: ${r.source}`] : []),
  ].join('\n');
}
const addButton = r => `<button class="secondary" data-add-recipe="${e(r.slug)}" hidden>Add ingredients</button>`;

const round = (key, value) => key === 'calories' || key === 'sodium' || value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
const show = (key, value) => value == null ? '—' : `${round(key, value).toLocaleString('en-US')}${nutrients[key].unit}`;
function nutritionLines(r, v) {
  const n = recipeNutrition(r, v);
  if (!n) return [];
  const per = n.perServing ? nutrients.keys.map(k => `${nutrients[k].label} ${show(k, n.perServing[k])}`).join(', ') : null;
  const batch = n.batch ? nutrients.keys.map(k => `${nutrients[k].label} ${show(k, n.batch[k])}`).join(', ') : null;
  return ['', `Nutrition (${n.label}):`, ...(per ? [`Per ${n.servingLabel}: ${per}`] : []), ...(batch ? [`Whole 1× batch: ${batch}`] : []), n.note];
}
function nutritionPanel(r, v) {
  const n = recipeNutrition(r, v);
  if (!n) return '';
  const cell = (k, value, scales) => `<td${scales && value != null ? ` data-batch="${value}" data-key="${k}"` : ''}>${show(k, value)}</td>`;
  return `<section class="split nutrition"${v ? ` data-variant="${e(v.id)}"` : ''} aria-labelledby="nutrition-${e(v?.id ?? 'recipe')}"><div class="split-label"><h2 id="nutrition-${e(v?.id ?? 'recipe')}">Nutrition</h2><p class="small">${e(n.label)}</p></div><div><table><thead><tr><th scope="col"><span class="sr-only">Nutrient</span></th>${n.perServing ? `<th scope="col">Per ${e(n.servingLabel)}</th>` : ''}${n.batch ? `<th scope="col">Whole batch <span class="batch-label">(1×)</span></th>` : ''}</tr></thead><tbody>${nutrients.keys.map(k => `<tr><th scope="row">${nutrients[k].label}</th>${n.perServing ? cell(k, n.perServing[k]) : ''}${n.batch ? cell(k, n.batch[k], true) : ''}</tr>`).join('')}</tbody></table><p class="small">${e(n.note)}</p></div></section>`;
}

await rm(root, {recursive:true, force:true});
await mkdir(root, {recursive:true});
await cp(new URL('../public/', import.meta.url), root, {recursive:true});
for (const {content, filename} of Object.values(assets)) await writeFile(new URL(filename, root), content);
async function output(path, html) {
  const dir = new URL(path, root);
  await mkdir(dir, {recursive:true});
  await writeFile(new URL('index.html', dir), html);
}

await output('./', page('Recipes', 'Recipes from Christian Wilkins, with scaling, nutrition estimates, and one shared grocery list.', '/', `
<section class="intro"><h1>Good things to make</h1><p class="lead">Recipes I keep coming back to. Scale a batch, check the nutrition, and add the ingredients to the shared grocery list.</p><p><a href="/shopping/">Open the grocery list</a></p><p class="action-status small" role="status" aria-live="polite"></p></section>
${[['Dinner','dinners','Dinners'], ['Dessert','desserts','Desserts'], ['Side dish','side-dishes','Side dishes']].map(([category,id,title]) => {
 const entries = recipes.filter(r => (r.category ?? 'Dessert') === category);
 if (!entries.length) return '';
 return `<section class="split" aria-labelledby="${id}"><div class="split-label"><h2 id="${id}">${title}</h2><p class="small">${entries.length} ${entries.length === 1 ? 'recipe' : 'recipes'}</p></div><div class="recipe-index">${entries.map(r=>`<article><h3><a href="/${r.slug}/">${e(r.title)}</a></h3><p>${e(r.description)}</p><p class="meta">${e(r.servings)}${r.variants ? ` · ${r.variants.length} options` : ''}</p><div class="actions">${addButton(r)}</div><p class="recipe-add-status small" role="status" aria-live="polite"></p></article>`).join('')}</div></section>`;
}).join('')}
<section class="split archive" aria-labelledby="archive"><div class="split-label"><h2 id="archive">From the archive</h2><p class="small">The original recipes from the repository.</p></div><ul><li><a href="https://github.com/christianwilkins/recipes/blob/main/korean-beef-bowl.md">Korean beef bowl ↗</a></li><li><a href="https://github.com/christianwilkins/recipes/blob/main/mac-and-cheese.md">Three-ingredient mac and cheese ↗</a></li><li><a href="https://github.com/christianwilkins/recipes/blob/main/smoothie.md">Smoothie ↗</a></li></ul></section>`));

const variantAttr = v => v ? ` data-variant="${e(v.id)}"` : '';
function variantPicker(r) {
  if (!r.variants) return '';
  return `<fieldset class="choice" data-param="${e(r.variantParam)}"><legend>${e(r.variantLegend)}</legend><div class="choice-options">${r.variants.map(v=>`<label><input type="radio" name="variant" id="variant-${e(v.id)}" value="${e(v.id)}"${v.default ? ' checked' : ''}><span>${e(variantName(v))}</span></label>`).join('')}</div>${r.variants.filter(v=>v.vegetarian).map(v=>`<p class="small"${variantAttr(v)}>${e(v.vegetarian)}</p>`).join('')}</fieldset>`;
}
// Scaling rewrites text, so the control only appears once JavaScript is running.
const scalePicker = () => `<fieldset class="choice scale-choice" hidden><legend>Batch size</legend><div class="choice-options">${scaleFactors.map(f=>`<label><input type="radio" name="scale" value="${f}"${f === 1 ? ' checked' : ''}><span>${factorLabel(f)}</span></label>`).join('')}</div></fieldset>`;
// Variant content is selected with CSS so the picker also works without JavaScript and in print.
const variantStyle = r => r.variants ? `<style>${r.variants.map(v=>`main:has(#variant-${v.id}:not(:checked)) [data-variant="${v.id}"]`).join(',')}{display:none!important}</style>` : '';
for (const r of recipes) {
 const variants = r.variants ?? [null];
 const prompts = variants.map(v=>{
  const id = v ? `recipe-prompt-text-${e(v.id)}` : 'recipe-prompt-text';
  const template = promptTemplate(r, v);
  return `<div class="field"${variantAttr(v)}><label for="${id}">Recipe prompt${v ? ` (${e(variantName(v).toLowerCase())})` : ''}</label><textarea id="${id}" data-prompt="${e(v?.id ?? '')}" data-template="${e(template)}" readonly rows="10">${e(plain(template))}</textarea></div>`;
 }).join('');
 const ingredientRow = (amount, name, key, v) => `<li${variantAttr(v)}><label><input type="checkbox" data-check="${key}"><span><strong data-qty="${e(amount)}">${e(amount)}</strong> ${e(name)}</span></label></li>`;
 const variantIngredients = (r.variants ?? []).map(v=>v.ingredients.map(([amount,name],i)=>ingredientRow(amount, name, `${r.slug}-${v.id}-${i}`, v)).join('')).join('');
 const variantLinks = (r.variants ?? []).filter(v=>v.link).map(v=>`<p class="small"${variantAttr(v)}><a href="/${e(v.link.slug)}/">${e(v.link.text)}</a> ${e(v.link.note)}</p>`).join('');
 const variantSteps = (r.variants ?? []).map(v=>v.steps.map(s=>`<li${variantAttr(v)}>${qty(s)}</li>`).join('')).join('');
 const times = r.variants?.some(v=>v.time) ? r.variants.map(v=>`<span${variantAttr(v)}>${e(v.time ?? r.time)}</span>`).join('') : e(r.time);
 const variantPrint = (r.variants ?? []).map(v=>`<span${variantAttr(v)}>${e(r.variantLegend)}: ${e(variantName(v))}. </span>`).join('');
 await output(`${r.slug}/`, page(r.title,r.description,`/${r.slug}/`,`
<p class="back"><a href="/">← All recipes</a></p><section class="recipe-heading"><h1>${e(r.title)}</h1><p class="lead">${e(r.description)}</p><p class="meta"><span data-qty="${e(r.servings)}">${e(r.servings)}</span> · ${times}</p><p class="print-only">${variantPrint}<span class="batch-print">Batch: 1×</span></p><div class="choices">${variantPicker(r)}${scalePicker()}</div><p class="choice-status small" role="status" aria-live="polite"></p><div class="actions">${addButton(r)}<a href="/shopping/">View grocery list</a><button class="secondary print" hidden>Print recipe</button>${r.source ? `<a href="${e(r.source)}">${e(r.sourceLabel ?? 'Prep with Drew’s reel')} ↗</a>` : ''}</div><p class="action-status small" role="status" aria-live="polite"></p></section>
<section class="split recipe-prompt" aria-labelledby="prompt-heading"><div class="split-label"><h2 id="prompt-heading">Make it with your agent</h2></div><div><p class="small">Copy the full recipe and a ready-to-use prompt for Muse, ChatGPT, or another agent. It follows the options you picked above.</p><div class="actions"><button class="button" data-copy-prompt hidden>Copy recipe prompt</button><button class="secondary" data-share-prompt hidden>Share prompt…</button></div><p class="prompt-status small" role="status" aria-live="polite"></p><details class="prompt-preview"><summary>View prompt</summary>${prompts}</details></div></section>
<div class="recipe-body"><section><h2>Ingredients</h2><p class="small">${r.unrecorded ? 'Check off as you cook.' : `For <span data-qty="${e(r.servings)}">${e(r.servings)}</span>. Check off as you cook.`}</p><ul class="ingredients">${variantIngredients}${r.ingredients.map(([amount,name],i)=>ingredientRow(amount, name, `${r.slug}-${i}`)).join('')}</ul>${variantLinks}${r.unrecorded ? `<p class="small unrecorded">Not recorded yet: ${e(r.unrecorded.join('; '))}. These are left blank rather than estimated.</p>` : ''}</section><section><h2>Method</h2><ol class="steps">${variantSteps}${r.steps.map(s=>`<li>${qty(s)}</li>`).join('')}</ol>${r.methodNote ? `<p class="small">${e(r.methodNote)}</p>` : ''}<div class="notes"><h3>A few useful notes</h3>${r.notes.map(n=>`<p>${e(n)}</p>`).join('')}</div>${r.related ? `<div class="notes"><h3>Use it in</h3>${r.related.map(x=>`<p><a href="${e(relatedPath(x))}">${e(x.text)}</a>. ${e(x.note)}</p>`).join('')}</div>` : ''}</section></div>
${variants.map(v=>nutritionPanel(r, v)).join('')}
${r.customization ? `<section class="split variations" aria-labelledby="variations-heading"><div class="split-label"><h2 id="variations-heading">Recipe variations and customization</h2></div><dl>${r.customization.map(([title,text])=>`<div><dt>${e(title)}</dt><dd>${qty(text)}</dd></div>`).join('')}</dl></section>` : ''}`, variantStyle(r)));
}
await output('shopping/', page('Grocery list', 'One shared grocery list. Add ingredients from recipes, add your own items, and edit from any device.', '/shopping/', `
<section class="shopping-heading"><h1>Grocery list</h1><p class="lead">One list for the next shop. Anyone with this page can edit it; changes are shared across devices.</p></section>
<form id="add-item" class="grocery-add"><div class="field"><label for="item-name">Add an item</label><input id="item-name" name="name" maxlength="140" placeholder="e.g. Greek yogurt" required autocomplete="off"></div><div class="field"><label for="item-quantity">Buy quantity</label><input id="item-quantity" name="quantity" maxlength="180" placeholder="e.g. 2 tubs" autocomplete="off"></div><div class="field"><label for="item-category">Category</label><select id="item-category" name="category">${categories.map(c=>`<option${c==='Other'?' selected':''}>${e(c)}</option>`).join('')}</select></div><button class="button" type="submit">Add item</button></form>
<div class="grocery-toolbar"><p id="grocery-count" class="small">Loading the shared list…</p><div><button id="refresh-list" class="secondary" type="button">Refresh</button><button class="secondary print" hidden>Print list</button></div></div>
<div class="grocery-feedback"><p id="grocery-status" role="status" aria-live="polite"></p><button id="undo-remove" class="secondary" hidden>Undo remove</button></div>
<div id="grocery-list" aria-busy="true"></div><noscript><p>This shared list needs JavaScript to load and save changes. Recipes can still be read without it.</p></noscript>
<section class="grocery-help"><h2>Cooking something?</h2><p><a href="/">Browse the recipes</a> and use “Add ingredients.” Matching ingredients share one row, with each recipe’s amounts listed underneath. Set the buy quantity to the amount or package size you want. Adding a recipe again keeps one copy of its ingredients and updates its amounts to the batch size you picked.</p><p class="small">The starting list includes the Trader Joe’s groceries, freezer meals, and skincare. Product availability and prices may vary. Tap water is left out of recipe additions.</p></section>`));
await output('trader-joes/',page('Grocery list','The grocery list is now shared.','/shopping/','<section class="intro"><h1>One shared list</h1><p><a href="/shopping/">Open the grocery list</a></p></section>'));
await writeFile(new URL('_redirects',root),'/trader-joes /shopping/ 301\n/trader-joes/ /shopping/ 301\n');
await writeFile(new URL('_routes.json',root),JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
await writeFile(new URL('404.html',root),page('Page not found','Find a saved recipe.','/404','<section class="intro"><h1>That page is missing</h1><p><a href="/">Back to the recipes</a></p></section>'));
await writeFile(new URL('robots.txt',root),'User-agent: *\nAllow: /\nSitemap: https://recipes.chriswiki.com/sitemap.xml\n');
await writeFile(new URL('sitemap.xml',root),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/',...recipes.map(r=>`/${r.slug}/`),'/shopping/'].map(p=>`<url><loc>https://recipes.chriswiki.com${p}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${recipes.length} public recipes and the shared grocery list.`);
