# Recipes

A public recipe notebook and shared [grocery list](https://recipes.chriswiki.com/shopping/) at [recipes.chriswiki.com](https://recipes.chriswiki.com).

Each recipe has an **Add ingredients** button. Ingredients shared by recipes use one grocery row, with each recipe’s required amount shown separately. The editable buy quantity stays independent so unlike units are never silently summed. Adding the same recipe again does not duplicate its requirements. Removed ingredients return when that recipe is added again; existing checked items stay checked.

Anyone can add, edit, check off, remove, or undo the most recent removal without signing in. The list is stored in Cloudflare D1 and refreshes across devices when focused or every 15 seconds while visible. Cooking checkboxes on recipe pages stay local to the browser. The initial shared list contains the Trader Joe’s trip, including satay ingredients and skincare; beef and cheese already at home are omitted from that seed.

## Editing and previewing

Recipe content lives in `data/recipes.json`. The build generates static pages in `dist/`; Pages Functions serve `/api/groceries`. The original trip data and dessert shopping estimates remain in `data/trader-joes.json` and `data/shopping.json` for reference. `/trader-joes/` redirects to the shared grocery list.

Use Node.js 24 or newer:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
npm run check:functions
npm run db:local
npm run dev
```

Open `http://localhost:4178`. Local D1 state lives in the ignored `.wrangler` directory and is separate from production. The checked-in database ID is a placeholder for local development. Recipe pages remain readable without JavaScript; shared grocery edits require JavaScript and a connection.

## Publishing

The manual **Deploy Recipes** workflow in [christianwilkins.github.io](https://github.com/christianwilkins/christianwilkins.github.io/actions/workflows/deploy-recipes.yml) builds an explicit commit SHA from this repository. It validates content and API behavior, finds or creates the named D1 database, replaces the placeholder binding ID in its temporary checkout, applies pending migrations, and deploys to the existing `chriswiki-recipes` Cloudflare Pages project.

The hosting repository’s existing `CLOUDFLARE_API_TOKEN` needs Account Cloudflare Pages Edit and D1 Edit for the account identified by `CLOUDFLARE_ACCOUNT_ID`. No credentials belong in this repository. Provisioning and migrations run before deployment; a failed database setup leaves the currently published site in place. Migrations seed the list only once, so future deployments preserve grocery edits.

The grocery API intentionally has no authentication. It bounds field sizes and the active list to 300 items, uses same-origin browser writes, and soft-deletes rows for Undo. Anyone who knows the URL can change this low-sensitivity list. Changes to a recipe’s ingredients require a code edit and deployment; public editing applies to the grocery list.

## Original collection

The original collection was forked from [keshavbabu/recipes](https://github.com/keshavbabu/recipes). Its markdown files are preserved:

- [Korean beef bowl](korean-beef-bowl.md)
- [Three-ingredient mac and cheese](mac-and-cheese.md)
- [Smoothie](smoothie.md)

Original contribution note: if you make a PR, add a picture of the final product.
