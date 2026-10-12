import reference from '../data/nutrition.json' with { type: 'json' };

export const nutrients = {
  keys: ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'],
  calories: { label: 'Calories', unit: '' },
  protein: { label: 'Protein', unit: 'g' },
  carbs: { label: 'Carbs', unit: 'g' },
  fat: { label: 'Fat', unit: 'g' },
  fiber: { label: 'Fiber', unit: 'g' },
  sodium: { label: 'Sodium', unit: 'mg' }
};
export const foods = reference.foods;
const list = items => items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0];
const shortName = name => name.replace(/[,;].*$/, '').trim();

// Ingredient rows can carry a third field, {food, g}, naming a USDA food and its grams at 1×.
// The estimate covers only mapped rows and says which ingredients it leaves out.
export function recipeNutrition(recipe, variant) {
  if (recipe.familyVariants) recipe = {...recipe, nutritionEstimate: variant?.nutritionEstimate, nutritionServings: variant?.nutritionServings};
  const servings = recipe.nutritionServings;
  if (recipe.nutritionEstimate) {
    const { label, note, ...perServing } = recipe.nutritionEstimate;
    const batch = Object.fromEntries(nutrients.keys.map(k => [k, perServing[k] == null ? null : perServing[k] * servings.count]));
    return { label, note, servingLabel: servings.label, perServing, batch };
  }
  const rows = [...(variant?.ingredients ?? []), ...recipe.ingredients];
  const mapped = rows.filter(row => row[2]);
  if (!mapped.length) return null;
  const batch = Object.fromEntries(nutrients.keys.map(k => [k, 0]));
  const missing = new Set();
  for (const [, , { food, g }] of mapped) {
    const values = foods[food]?.per100g;
    if (!values) throw new Error(`Unknown nutrition food: ${food}`);
    for (const k of nutrients.keys) {
      if (values[k] == null) missing.add(k);
      else batch[k] += values[k] * g / 100;
    }
  }
  for (const k of missing) batch[k] = null;
  const perServing = servings ? Object.fromEntries(nutrients.keys.map(k => [k, batch[k] == null ? null : batch[k] / servings.count])) : null;
  const left = rows.filter(([, name, map]) => !map && !/^(hot )?water\b/i.test(name)).map(([, name]) => shortName(name));
  const assumptions = [...new Set(mapped.map(row => row[2].note).filter(Boolean))];
  const note = [
    `Estimated from USDA FoodData Central values for each counted ingredient. Ranges use their midpoint.`,
    ...assumptions,
    left.length ? `Not counted: ${list(left)}.` : '',
    missing.size ? `${list([...missing].map(k => nutrients[k].label))} data is missing for at least one ingredient, so that total is not shown.` : '',
    servings?.note ?? '',
    recipe.nutritionNote ?? ''
  ].filter(Boolean).join(' ');
  return { label: recipe.nutritionLabel ?? 'Estimate', note, servingLabel: servings?.label, perServing, batch };
}
