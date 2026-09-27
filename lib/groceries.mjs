import recipes from '../data/recipes.json' with { type: 'json' };

export const categories = ['Produce', 'Meat, dairy, and refrigerated', 'Rice, beans, and pantry', 'Freezer', 'Skincare', 'Other'];
const aliases = [
  [/greek yogurt/i, 'Plain Greek yogurt', categories[1]],
  [/coconut milk/i, 'Coconut milk', categories[2]],
  [/red curry paste/i, 'Thai red curry paste', categories[2]],
  [/curry powder/i, 'Curry powder', categories[2]],
  [/soy sauce/i, 'Soy sauce', categories[2]],
  [/powdered peanut butter/i, 'Powdered peanut butter', categories[2]],
  [/peanuts/i, 'Roasted peanuts', categories[2]],
  [/chicken thigh/i, 'Boneless, skinless chicken thighs', categories[1]],
  [/sweet potatoes/i, 'Sweet potatoes', categories[0]],
  [/ground beef/i, 'Ground beef', categories[1]],
  [/shredded cheese/i, 'Shredded cheese', categories[1]],
  [/taco seasoning/i, 'Taco seasoning', categories[2]],
  [/pico de gallo/i, 'Pico de gallo', categories[1]],
  [/avocado/i, 'Avocados', categories[0]],
  [/lime/i, 'Limes', categories[0]],
  [/cilantro/i, 'Cilantro', categories[0]],
  [/^(fresh )?chili( for serving)?$/i, 'Fresh chili', categories[0]],
  [/^(dry jasmine or brown rice|rice.*)$/i, 'Rice', categories[2]],
  [/^(canned black beans|black beans, drained)/i, 'Canned black beans', categories[2]],
  [/dried black beans/i, 'Dried black beans', categories[2]],
  [/^(bananas?|banana,.*)$/i, 'Bananas', categories[0]],
  [/^(salt|salt,.*)$/i, 'Salt', categories[2]],
  [/honey/i, 'Honey', categories[2]],
  [/cream cheese/i, 'Cream cheese', categories[1]],
  [/fat-free milk/i, 'Milk', categories[1]],
  [/whey protein/i, 'Vanilla whey protein', categories[2]],
  [/monk fruit/i, 'Monk fruit sweetener', categories[2]],
  [/biscoff cookie butter/i, 'Biscoff cookie butter', categories[2]],
  [/biscoff cookie/i, 'Biscoff cookies', categories[2]],
  [/nilla wafer/i, 'Vanilla wafers', categories[2]]
];

export function ingredient(name) {
  const match = aliases.find(([pattern]) => pattern.test(name));
  const clean = match?.[1] ?? name.replace(/,.*$/, '').replace(/ for (the )?(marinade|sauce|serving)$/, '').trim();
  return { key: clean.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim(), name: clean, category: match?.[2] ?? 'Other' };
}

export function recipeItems(slug) {
  const recipe = recipes.find(entry => entry.slug === slug);
  if (!recipe) return null;
  const grouped = new Map();
  for (const [amount, name] of recipe.ingredients) {
    // Tap water is available at home, not a grocery purchase.
    if (/^(hot )?water\b/i.test(name)) continue;
    const item = ingredient(name);
    const existing = grouped.get(item.key) ?? { ...item, amounts: [] };
    existing.amounts.push(`${amount} ${name}`);
    grouped.set(item.key, existing);
  }
  return { recipe, items: [...grouped.values()].map(item => ({...item, amount: item.amounts.join('; ')})) };
}

export function insertItem(db, item, revive = false) {
  return db.prepare(`INSERT INTO groceries (item_key, name, quantity, category, note) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(item_key) DO UPDATE SET
      deleted = CASE WHEN ? THEN 0 ELSE groceries.deleted END,
      checked = CASE WHEN ? AND groceries.deleted = 1 THEN 0 ELSE groceries.checked END`)
    .bind(item.key, item.name, item.quantity ?? '', item.category ?? 'Other', item.note ?? '', Number(revive), Number(revive));
}

export async function readList(db) {
  const [items, sources] = await db.batch([
    db.prepare('SELECT id, name, quantity, category, note, checked FROM groceries WHERE deleted = 0 ORDER BY id'),
    db.prepare('SELECT s.item_id, s.slug, s.title, s.amount FROM grocery_sources s JOIN groceries g ON g.id = s.item_id WHERE g.deleted = 0 ORDER BY s.slug')
  ]);
  return items.results.map(item => ({ ...item, checked: Boolean(item.checked), sources: sources.results.filter(source => source.item_id === item.id) }));
}

const json = (value, status = 200) => Response.json(value, {status, headers: {'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}});
class InputError extends Error {}
function field(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new InputError('Check the item fields and try again.');
  return value.trim();
}

export async function handleGroceries(request, db) {
  try {
    const path = new URL(request.url).pathname.replace(/\/$/, '');
    const root = '/api/groceries';
    if (request.method === 'GET' && path === root) return json({items: await readList(db)});
    if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) return json({error:'Method not allowed.'}, 405);
    const origin = request.headers.get('Origin');
    if (origin && origin !== new URL(request.url).origin) return json({error:'Open the grocery list to make changes.'}, 403);
    let body = {};
    if (request.method !== 'DELETE') {
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Expected JSON.'}, 415);
      const raw = await request.text();
      if (raw.length > 8192) return json({error:'This item is too long.'}, 413);
      try { body = JSON.parse(raw); } catch { throw new InputError('Invalid request.'); }
      if (!body || Array.isArray(body) || typeof body !== 'object') throw new InputError('Invalid request.');
    }
    if (request.method === 'POST' && path === `${root}/recipe`) {
      const data = recipeItems(body.slug);
      if (!data) return json({error:'Recipe not found.'}, 404);
      const statements = data.items.flatMap(item => [
        insertItem(db, item, true),
        db.prepare(`INSERT INTO grocery_sources (item_id, slug, title, amount)
          SELECT id, ?, ?, ? FROM groceries WHERE item_key = ?
          ON CONFLICT(item_id, slug) DO NOTHING`).bind(data.recipe.slug, data.recipe.title, item.amount, item.key)
      ]);
      await db.batch(statements);
      return json({items: await readList(db), message:`Ingredients for ${data.recipe.title} are on the list.`});
    }
    if (request.method === 'POST' && path === root) {
      const name = field(body.name, 140, true);
      const quantity = field(body.quantity ?? '', 180);
      const note = field(body.note ?? '', 600);
      if (!categories.includes(body.category)) throw new InputError('Choose a category.');
      const key = ingredient(name).key;
      if (!key) throw new InputError('Enter an item name.');
      const existing = await db.prepare('SELECT id FROM groceries WHERE item_key = ? AND deleted = 0').bind(key).first();
      if (existing) return json({error:'This item is already on the list. Use Edit to change its quantity.'}, 409);
      await db.batch([insertItem(db, {key, name, quantity, note, category:body.category}, true), db.prepare('UPDATE groceries SET name = ?, quantity = ?, note = ?, category = ? WHERE item_key = ?').bind(name, quantity, note, body.category, key)]);
      return json({items: await readList(db)}, 201);
    }
    const id = path.startsWith(`${root}/`) ? path.slice(root.length + 1) : '';
    if (!/^\d+$/.test(id)) return json({error:'Item not found.'}, 404);
    const existing = await db.prepare('SELECT id FROM groceries WHERE id = ?').bind(Number(id)).first();
    if (!existing) return json({error:'Item not found.'}, 404);
    if (request.method === 'DELETE') {
      await db.prepare('UPDATE groceries SET deleted = 1 WHERE id = ?').bind(Number(id)).run();
    } else if (request.method === 'PATCH') {
      const assignments = [], values = [];
      for (const [key, max] of [['name',140], ['quantity',180], ['note',600]]) {
        if (key in body) { assignments.push(`${key} = ?`); values.push(field(body[key], max, key === 'name')); }
      }
      if ('category' in body) {
        if (!categories.includes(body.category)) throw new InputError('Choose a category.');
        assignments.push('category = ?'); values.push(body.category);
      }
      for (const key of ['checked', 'deleted']) {
        if (key in body) {
          if (typeof body[key] !== 'boolean') throw new InputError('Invalid item state.');
          assignments.push(`${key} = ?`); values.push(Number(body[key]));
        }
      }
      if ('name' in body) {
        const key = ingredient(body.name).key;
        if (!key) throw new InputError('Enter an item name.');
        assignments.push('item_key = ?'); values.push(key);
      }
      if (!assignments.length) throw new InputError('No changes to save.');
      await db.prepare(`UPDATE groceries SET ${assignments.join(', ')} WHERE id = ?`).bind(...values, Number(id)).run();
    } else return json({error:'Method not allowed.'}, 405);
    return json({items: await readList(db)});
  } catch (error) {
    if (error instanceof InputError) return json({error:error.message}, 400);
    if (/UNIQUE constraint/.test(error.message)) return json({error:'An item with that name already exists.'}, 409);
    if (/list is full/.test(error.message)) return json({error:'The list is full. Remove an item before adding more.'}, 409);
    console.error('Grocery operation failed:', error.message);
    return json({error:'The list could not be saved or loaded. Try again.'}, 503);
  }
}
