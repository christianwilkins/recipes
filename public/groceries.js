const list = document.querySelector('#grocery-list');
const status = document.querySelector('#grocery-status');
const count = document.querySelector('#grocery-count');
const addForm = document.querySelector('#add-item');
const undoButton = document.querySelector('#undo-remove');
const categoryNames = [...addForm.elements.category.options].map(option=>option.value);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items = [], busy = false, editing = null, removed = null, revision = 0, loaded = false;
const options = selected => categoryNames.map(name=>`<option${name===selected?' selected':''}>${escapeHtml(name)}</option>`).join('');

async function api(path = '', method = 'GET', body) {
  const response = await fetch(`/api/groceries${path}`,{method,headers:body ? {'Content-Type':'application/json'} : {},body:body ? JSON.stringify(body) : undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
  let data;
  try { data = await response.json(); } catch { throw new Error('The grocery list is unavailable. Try Refresh in a moment.'); }
  if (!response.ok) throw new Error(data.error || 'Could not save the list. Try again.');
  return data;
}
function errorMessage(error) {
  if (['TimeoutError','AbortError'].includes(error.name)) return 'The connection timed out. Refresh to check whether your change saved.';
  return error.message === 'Failed to fetch' ? 'Could not connect. Check your connection and try again.' : error.message;
}
function render() {
  const checked = items.filter(item=>item.checked).length;
  count.textContent = `${items.length - checked} to buy · ${checked} checked off`;
  list.setAttribute('aria-busy','false');
  if (!items.length) {
    list.innerHTML = '<div class="grocery-empty"><h2>All clear.</h2><p>Add an item above, or choose a recipe to start your next shop.</p><a href="/">Browse recipes</a></div>';
    return;
  }
  list.innerHTML = categoryNames.map(category=>{
    const group = items.filter(item=>item.category===category);
    if (!group.length) return '';
    return `<section class="grocery-group"><h2>${escapeHtml(category)}</h2><ul>${group.map(item=>{
      const name = escapeHtml(item.name);
      if (editing === item.id) return `<li class="grocery-row"><form class="grocery-edit" data-edit-id="${item.id}"><div class="field"><label for="edit-name-${item.id}">Item</label><input id="edit-name-${item.id}" name="name" value="${name}" maxlength="140" required></div><div class="field"><label for="edit-quantity-${item.id}">Buy quantity</label><input id="edit-quantity-${item.id}" name="quantity" value="${escapeHtml(item.quantity)}" maxlength="180"></div><div class="field"><label for="edit-category-${item.id}">Category</label><select id="edit-category-${item.id}" name="category">${options(item.category)}</select></div><div class="field edit-note"><label for="edit-note-${item.id}">Note</label><textarea id="edit-note-${item.id}" name="note" maxlength="600" rows="2">${escapeHtml(item.note)}</textarea></div><div class="edit-actions"><button class="button" type="submit">Save changes</button><button class="secondary" type="button" data-action="cancel" data-id="${item.id}">Cancel</button></div></form></li>`;
      return `<li class="grocery-row${item.checked?' is-checked':''}" data-row="${item.id}"><label class="grocery-check"><input type="checkbox" data-action="check" data-id="${item.id}" ${item.checked?'checked':''}><span class="grocery-copy"><strong>${name}</strong>${item.quantity?`<span class="buy-quantity">${escapeHtml(item.quantity)}</span>`:''}</span></label><div class="grocery-row-actions"><button type="button" class="text-button" data-action="edit" data-id="${item.id}" aria-label="Edit ${name}">Edit</button><button type="button" class="text-button" data-action="remove" data-id="${item.id}" aria-label="Remove ${name}">Remove</button></div>${item.note?`<p class="grocery-note">${escapeHtml(item.note)}</p>`:''}${item.sources.length?`<ul class="grocery-sources">${item.sources.map(source=>`<li><a href="/${encodeURIComponent(source.slug)}/">${escapeHtml(source.title)}</a>: ${escapeHtml(source.amount)}</li>`).join('')}</ul>`:''}</li>`;
    }).join('')}</ul></section>`;
  }).join('');
}
function disable(value) {
  for (const control of document.querySelectorAll('#grocery-list button, #grocery-list input, #grocery-list select, #grocery-list textarea, #add-item button, #undo-remove')) control.disabled = value;
}
async function refresh(silent = false) {
  if (busy || editing !== null) return;
  const current = ++revision;
  try {
    const data = await api();
    if (current !== revision || editing !== null || busy) return;
    const changed = !loaded || JSON.stringify(items)!==JSON.stringify(data.items);
    items = data.items; loaded = true;
    if (changed) render();
    if (!silent) status.textContent = 'List is up to date.';
  } catch(error) {
    if(current !== revision) return;
    status.textContent = errorMessage(error);
    list.setAttribute('aria-busy','false');
    if(!loaded) count.textContent = 'List could not be loaded.';
  }
}
async function mutate(path, method, body, message, onSuccess) {
  if(busy) return;
  busy = true; revision++; disable(true); status.textContent = 'Saving…';
  try {
    const data = await api(path,method,body);
    items = data.items; loaded = true; editing = null;
    render(); onSuccess?.(); status.textContent = message;
  } catch(error) {
    status.textContent = errorMessage(error);
    // Keep failed edits and manual input intact; restore checkbox state from the last confirmed list.
    for(const checkbox of list.querySelectorAll('[data-action="check"]')) checkbox.checked = items.find(item=>item.id===Number(checkbox.dataset.id))?.checked ?? false;
  } finally { busy = false; disable(false); }
}
addForm.addEventListener('submit',event=>{
  event.preventDefault();
  const data=Object.fromEntries(new FormData(addForm));
  mutate('','POST',data,`${data.name} added.`,()=>{addForm.reset(); addForm.elements.name.focus();});
});
list.addEventListener('change',event=>{
  const target = event.target;
  if(target.dataset.action !== 'check') return;
  const id=Number(target.dataset.id);
  const checked=target.checked;
  const item=items.find(item=>item.id===id);
  mutate(`/${id}`,'PATCH',{checked},`${item.name} ${checked?'checked off':'back on the list'}.`,()=>list.querySelector(`[data-action="check"][data-id="${id}"]`)?.focus());
});
list.addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');
  if(!button || busy) return;
  const id=Number(button.dataset.id), item=items.find(item=>item.id===id);
  if(button.dataset.action==='edit') { editing=id; render(); list.querySelector('[name="name"]').focus(); }
  if(button.dataset.action==='cancel') { editing=null; render(); list.querySelector(`[data-action="edit"][data-id="${id}"]`)?.focus(); }
  if(button.dataset.action==='remove') mutate(`/${id}`,'DELETE',undefined,`${item.name} removed.`,()=>{removed=item; undoButton.hidden=false; undoButton.focus();});
});
list.addEventListener('submit',event=>{
  if(!event.target.matches('[data-edit-id]')) return;
  event.preventDefault();
  const form=event.target;
  mutate(`/${form.dataset.editId}`,'PATCH',Object.fromEntries(new FormData(form)),'Changes saved.');
});
undoButton.addEventListener('click',()=>{
  if(!removed) return;
  mutate(`/${removed.id}`,'PATCH',{deleted:false},`${removed.name} restored.`,()=>{removed=null;undoButton.hidden=true;});
});
document.querySelector('#refresh-list').addEventListener('click',()=>{
  if(editing!==null) { status.textContent='Save or cancel your edit before refreshing.'; return; }
  refresh();
});
window.addEventListener('focus',()=>refresh(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden) refresh(true);});
setInterval(()=>{if(!document.hidden) refresh(true);},15000);
refresh();
