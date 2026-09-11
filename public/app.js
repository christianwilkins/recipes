const checks = [...document.querySelectorAll('[data-check]')];
const budget = document.querySelector('#budget-mode');
const rows = [...document.querySelectorAll('.shopping-item')];
let saved = {};
let storageAvailable = true;
try {
  const value = JSON.parse(localStorage.getItem('recipes.checklist.v1') || '{}');
  if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
} catch { storageAvailable = false; }

function update() {
  let total = 0;
  let checked = 0;
  let visible = 0;
  rows.forEach(row => {
    const isBudget = budget?.checked;
    const omitted = isBudget && row.dataset.omitBudget === 'true';
    row.hidden = omitted;
    const swapped = isBudget && row.dataset.budgetPrice;
    const price = Number(swapped ? row.dataset.budgetPrice : row.dataset.price);
    const input = row.querySelector('input');
    if (!omitted) {
      visible++;
      if (input.checked) checked++;
      else total += Math.round(price * 100);
    }
    const original = row.querySelector('[data-buy-original]');
    const replacement = row.querySelector('[data-buy-budget]');
    if (replacement) {
      original.hidden = Boolean(swapped);
      replacement.hidden = !swapped;
    }
    const note = row.querySelector('[data-price-note]');
    const estimated = swapped || note.textContent === 'Online estimate';
    row.querySelector('[data-display-price]').textContent = `${estimated ? '~' : ''}$${price.toFixed(2)}`;
  });
  if (rows.length) {
    document.querySelector('#basket-total').textContent = `$${(total / 100).toFixed(2)}`;
    document.querySelector('#list-status').textContent = `${checked} of ${visible} items checked${storageAvailable ? '' : ' · Saving unavailable in this browser'}`;
  }
}

function save() {
  try { localStorage.setItem('recipes.checklist.v1', JSON.stringify(saved)); }
  catch { storageAvailable = false; }
  update();
}

checks.forEach(input => {
  input.checked = saved[input.dataset.check] === true;
  input.addEventListener('change', () => {
    saved[input.dataset.check] = input.checked;
    save();
  });
});
if (budget) {
  budget.closest('label').hidden = false;
  budget.checked = saved.budget === true;
  budget.addEventListener('change', () => { saved.budget = budget.checked; save(); });
}
const reset = document.querySelector('#reset');
if (reset) {
  reset.hidden = false;
  reset.addEventListener('click', () => {
    checks.forEach(input => { input.checked = false; delete saved[input.dataset.check]; });
    save();
  });
}
document.querySelectorAll('.print').forEach(button => {
  button.hidden = false;
  button.addEventListener('click', () => window.print());
});
update();
