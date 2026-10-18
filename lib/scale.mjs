// Scales the numbers in free text amounts such as "1½ tbsp", "200–250g", or "8 cans (15 oz each)".
// Text inside parentheses describes a unit, not a quantity, so it is never scaled.
export const scaleFactors = [0.5, 1, 1.5, 2, 3];
const glyphs = { '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8 };
const fractionSteps = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾'], [1, '']];
const plurals = { can: 'cans', cup: 'cups', clove: 'cloves', scoop: 'scoops', skewer: 'skewers', bowl: 'bowls', serving: 'servings', potato: 'potatoes', portion: 'portions', quesadilla: 'quesadillas', tortilla: 'tortillas', jar: 'jars' };
const singulars = Object.fromEntries(Object.entries(plurals).map(([one, many]) => [many, one]));
// A count word may follow up to two describing words: "2 rice bowls", "4 stuffed sweet potatoes".
const countWord = new RegExp(`(^|[^\\w.])([\\d½¼¾⅓⅔⅛.]+) ((?:\\w+ ){0,2}?)(${Object.entries(plurals).flat().join('|')})\\b`, 'gi');
const quantity = String.raw`\d+(?:\.\d+)?[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛]`;
// A number or range, with the unit word after it captured so "100–125g" is treated as metric throughout.
const range = new RegExp(`(${quantity})(?:–(${quantity}))?(?=(?:\\s?([A-Za-z]+))?)`, 'g');
const parse = token => {
  const [, digits, glyph] = token.match(/^(\d+(?:\.\d+)?)?([½¼¾⅓⅔⅛])?$/);
  return (digits ? Number(digits) : 0) + (glyph ? glyphs[glyph] : 0);
};

function format(value, metric, decimal) {
  // Normalized recipes can have small decimal amounts; retain them across batches.
  if (decimal) return String(Math.round(value * 1000) / 1000);
  if (metric) {
    if (value >= 100) return String(Math.round(value / 5) * 5);
    if (value >= 10) return String(Math.round(value));
    return String(Math.round(value * 2) / 2);
  }
  let whole = Math.floor(value);
  const [fraction, glyph] = fractionSteps.reduce((best, step) => Math.abs(value - whole - step[0]) < Math.abs(value - whole - best[0]) ? step : best);
  // Avoid rounding small spices to zero or forcing an inaccurate kitchen fraction.
  if (Math.abs(value - whole - fraction) > 0.01 || (value > 0 && whole === 0 && fraction === 0)) return String(Math.round(value * 1000) / 1000);
  if (fraction === 1) whole += 1;
  return whole ? `${whole}${glyph}` : glyph || '0';
}

export function scaleAmount(text, factor) {
  if (factor === 1) return text;
  let depth = 0;
  let out = '';
  // Walk the text so parenthesized descriptions stay untouched.
  for (const part of String(text).split(/([()])/)) {
    if (part === '(') depth++;
    if (part === ')') depth = Math.max(0, depth - 1);
    if (depth || part === '(' || part === ')') { out += part; continue; }
    out += part.replace(range, (match, low, high, unit) => {
      const metric = /^(g|kg|ml)$/i.test(unit ?? '');
      const scaled = token => format(parse(token) * factor, metric, token.includes('.'));
      return high ? `${scaled(low)}–${scaled(high)}` : scaled(low);
    });
  }
  // Keep count words agreeing with the scaled number: "1 can", "2 cans".
  return out.replace(countWord, (match, lead, value, between, word) => {
    const many = !/^1$|^[½¼¾⅓⅔⅛]$|^0/.test(value);
    const lower = word.toLowerCase();
    if (many && plurals[lower]) return `${lead}${value} ${between}${plurals[lower]}`;
    if (!many && singulars[lower]) return `${lead}${value} ${between}${singulars[lower]}`;
    return match;
  });
}

// Recipe text marks scalable quantities with braces: "Add {2 tbsp} vinegar".
export function scaleText(text, factor, wrap = amount => amount) {
  return String(text).replace(/\{([^{}]+)\}/g, (match, amount) => wrap(scaleAmount(amount, factor), amount));
}
