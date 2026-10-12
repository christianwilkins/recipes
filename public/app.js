let saved = {};
try { saved = JSON.parse(localStorage.getItem('recipes.checklist.v1') || '{}') || {}; } catch { /* Cooking checks still work without storage. */ }
if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
for (const input of document.querySelectorAll('[data-check]')) {
  input.checked = saved[input.dataset.check] === true;
  input.addEventListener('change', () => {
    saved[input.dataset.check] = input.checked;
    try { localStorage.setItem('recipes.checklist.v1',JSON.stringify(saved)); } catch { /* This is only the local cooking checklist. */ }
  });
}
for (const button of document.querySelectorAll('.print')) {
  button.hidden = false;
  button.addEventListener('click',()=>window.print());
}
// Recipe options: CSS shows the checked variant; this keeps the URL, prompt, and grocery add in sync.
// scaleAmount and scaleText come from lib/scale.mjs, which the build places ahead of this file.
const variantInputs = [...document.querySelectorAll('input[name="variant"]')];
const scaleInputs = [...document.querySelectorAll('input[name="scale"]')];
const currentVariant = () => variantInputs.find(input => input.checked)?.value;
const currentScale = () => Number(scaleInputs.find(input => input.checked)?.value ?? 1);
const choiceStatus = document.querySelector('.choice-status');
const scaleLabel = factor => `${{0.5:'½', 1.5:'1½'}[factor] ?? factor}×`;
const formatNutrient = (key, value) => `${(key === 'calories' || key === 'sodium' || value >= 100 ? Math.round(value) : Math.round(value * 10) / 10).toLocaleString('en-US')}${{calories:'', sodium:'mg'}[key] ?? 'g'}`;
function applyScale() {
  const factor = currentScale();
  for (const element of document.querySelectorAll('[data-qty]')) element.textContent = scaleAmount(element.dataset.qty, factor);
  for (const cell of document.querySelectorAll('td[data-batch]')) cell.textContent = formatNutrient(cell.dataset.key, Number(cell.dataset.batch) * factor);
  for (const label of document.querySelectorAll('.batch-label')) label.textContent = `(${scaleLabel(factor)})`;
  for (const label of document.querySelectorAll('.batch-print')) label.textContent = `Batch: ${scaleLabel(factor)}`;
  for (const prompt of document.querySelectorAll('[data-template]')) prompt.value = scaleText(prompt.dataset.template.replace('Batch: 1×', `Batch: ${scaleLabel(factor)}`), factor);
}
function syncUrl(name, input) {
  const url = new URL(location.href);
  const slug = document.querySelector('[data-recipe-slug]')?.dataset.recipeSlug;
  if (name !== 'batch' && slug) {
    url.pathname = `/${slug}/${input.value}/`;
    url.searchParams.delete(name);
  } else if (input.defaultChecked) url.searchParams.delete(name); else url.searchParams.set(name, input.value);
  history.replaceState(null, '', url);
}
function resetAddButton() {
  const addButton = document.querySelector('[data-add-recipe]');
  if (addButton && !addButton.disabled) addButton.textContent = 'Add ingredients';
  const status = document.querySelector('.action-status');
  if (status) status.textContent = '';
}
if (variantInputs.length) {
  const param = variantInputs[0].closest('fieldset').dataset.param;
  const requested = variantInputs.find(input => input.value === new URLSearchParams(location.search).get(param));
  if (requested) requested.checked = true;
  for (const input of variantInputs) input.addEventListener('change', () => {
    syncUrl(param, input);
    choiceStatus.textContent = `Showing ${input.labels[0].textContent}.`;
    resetAddButton();
  });
}
if (scaleInputs.length) {
  scaleInputs[0].closest('fieldset').hidden = false;
  const requested = scaleInputs.find(input => input.value === new URLSearchParams(location.search).get('batch'));
  if (requested) requested.checked = true;
  applyScale();
  for (const input of scaleInputs) input.addEventListener('change', () => {
    applyScale();
    syncUrl('batch', input);
    choiceStatus.textContent = `Amounts and nutrition now show a ${input.labels[0].textContent} batch.`;
    resetAddButton();
  });
}
for (const button of document.querySelectorAll('[data-add-recipe]')) {
  button.hidden = false;
  button.addEventListener('click',async () => {
    const status = button.closest('article')?.querySelector('.recipe-add-status') ?? document.querySelector('.action-status');
    button.disabled = true;
    button.textContent = 'Adding…';
    status.textContent = '';
    try {
      const response = await fetch('/api/groceries/recipe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:button.dataset.addRecipe,variant:currentVariant(),scale:scaleInputs.length ? currentScale() : undefined}),signal:AbortSignal.timeout(15000)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not add ingredients. Try again.');
      status.replaceChildren(document.createTextNode('Ingredients added. '));
      const link = document.createElement('a');
      link.href = '/shopping/'; link.textContent = 'Open grocery list'; status.append(link);
      button.textContent = 'Added to list';
    } catch (error) {
      status.textContent = error.name === 'TimeoutError' ? 'Could not confirm the save. Try again; ingredients will not be duplicated.' : (error.message === 'Failed to fetch' ? 'Could not connect. Check your connection and try again.' : error.message);
      button.textContent = 'Try adding again';
    } finally { button.disabled = false; }
  });
}

const activePrompt = () => document.querySelector(`[data-prompt="${currentVariant() ?? ''}"]`);
const recipeHeading = document.querySelector('[data-recipe-slug]');
if (recipeHeading) {
  const slug = recipeHeading.dataset.recipeSlug;
  const copy = document.querySelector('[data-copy-link]');
  const share = document.querySelector('[data-share-link]');
  const status = document.querySelector('.share-status');
  const linkData = () => {
    const variant = currentVariant();
    const url = new URL(`/${slug}/${variant ? `${variant}/` : ''}`, location.origin);
    if (currentScale() !== 1) url.searchParams.set('batch', currentScale());
    url.searchParams.set('preview', variantInputs.find(input => input.checked)?.dataset.shareVersion ?? recipeHeading.dataset.shareVersion);
    const label = variantInputs.find(input => input.checked)?.labels[0].textContent;
    return {title: `${label ? `${label} · ` : ''}${document.querySelector('h1').textContent}`, url: url.href};
  };
  const manualCopy = () => {
    const field = document.querySelector('.manual-link');
    const input = field.querySelector('input');
    field.hidden = false;
    input.value = linkData().url;
    input.focus(); input.select();
    status.textContent = 'Copy the selected link and paste it into Messages.';
  };
  copy.hidden = typeof navigator.share === 'function';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(linkData().url);
      status.textContent = 'Link copied. Ready to paste into Messages.';
    } catch { manualCopy(); }
  });
  if (typeof navigator.share === 'function') {
    share.hidden = false;
    share.addEventListener('click', async () => {
      try { await navigator.share(linkData()); }
      catch (error) { if (error.name !== 'AbortError') manualCopy(); }
    });
  }
}
if (activePrompt()) {
  const copyButton = document.querySelector('[data-copy-prompt]');
  const shareButton = document.querySelector('[data-share-prompt]');
  const status = document.querySelector('.prompt-status');
  const showManualCopy = message => {
    const promptText = activePrompt();
    document.querySelector('.prompt-preview').open = true;
    promptText.focus();
    promptText.select();
    status.textContent = message;
  };
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    copyButton.disabled = true;
    status.textContent = '';
    try {
      await navigator.clipboard.writeText(activePrompt().value);
      status.textContent = 'Prompt copied. Paste it into Muse or your preferred agent.';
    } catch {
      showManualCopy('Select and copy the prompt below, then paste it into your agent.');
    } finally { copyButton.disabled = false; }
  });
  const shareData = () => ({title: document.querySelector('h1').textContent, text: activePrompt().value});
  if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(shareData()))) {
    shareButton.hidden = false;
    shareButton.addEventListener('click', async () => {
      shareButton.disabled = true;
      status.textContent = '';
      try {
        await navigator.share(shareData());
      } catch (error) {
        if (error.name !== 'AbortError') showManualCopy('Sharing is unavailable. Copy the prompt below and paste it into your agent.');
      } finally { shareButton.disabled = false; }
    });
  }
}

const search = document.querySelector('#recipe-search');
if (search) {
  search.closest('.recipe-search').hidden = false;
  search.addEventListener('input', () => {
    const query = search.value.toLowerCase().trim();
    let count = 0;
    for (const card of document.querySelectorAll('[data-search]')) {
      card.hidden = !card.dataset.search.includes(query);
      if (!card.hidden) count++;
    }
    for (const group of document.querySelectorAll('.recipe-category')) group.hidden = !group.querySelector('article:not([hidden])');
    document.querySelector('#search-status').textContent = count ? `${count} recipes found.` : 'No recipes match. Try another ingredient or flavor.';
  });
}
