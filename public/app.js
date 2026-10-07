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
for (const button of document.querySelectorAll('[data-add-recipe]')) {
  button.hidden = false;
  button.addEventListener('click',async () => {
    const status = button.closest('article')?.querySelector('.recipe-add-status') ?? document.querySelector('.action-status');
    button.disabled = true;
    button.textContent = 'Adding…';
    status.textContent = '';
    try {
      const response = await fetch('/api/groceries/recipe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:button.dataset.addRecipe}),signal:AbortSignal.timeout(15000)});
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

const promptText = document.querySelector('#recipe-prompt-text');
if (promptText) {
  const copyButton = document.querySelector('[data-copy-prompt]');
  const shareButton = document.querySelector('[data-share-prompt]');
  const status = document.querySelector('.prompt-status');
  const showManualCopy = message => {
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
      await navigator.clipboard.writeText(promptText.value);
      status.textContent = 'Prompt copied. Paste it into Muse or your preferred agent.';
    } catch {
      showManualCopy('Select and copy the prompt below, then paste it into your agent.');
    } finally { copyButton.disabled = false; }
  });
  const shareData = {title: document.querySelector('h1').textContent, text: promptText.value};
  if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(shareData))) {
    shareButton.hidden = false;
    shareButton.addEventListener('click', async () => {
      shareButton.disabled = true;
      status.textContent = '';
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error.name !== 'AbortError') showManualCopy('Sharing is unavailable. Copy the prompt below and paste it into your agent.');
      } finally { shareButton.disabled = false; }
    });
  }
}
