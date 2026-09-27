# Recipes

A personal recipe notebook at [recipes.chriswiki.com](https://recipes.chriswiki.com).

- [Protein banana pudding](https://recipes.chriswiki.com/protein-banana-pudding/)
- [Biscoff protein cheesecake bowl](https://recipes.chriswiki.com/biscoff-protein-cheesecake-bowl/)
- [Combined shopping checklist](https://recipes.chriswiki.com/shopping/)
- [Trader Joe’s grocery and skincare checklist](https://recipes.chriswiki.com/trader-joes/)
- [Beef and black bean stuffed sweet potatoes](https://recipes.chriswiki.com/beef-stuffed-sweet-potatoes/)
- [Chicken satay rice bowls](https://recipes.chriswiki.com/chicken-satay-rice-bowls/)

The two dessert recipes are adapted from Prep with Drew's Instagram captions, linked on each page. Shopping prices are dated September 11, 2026; local pickup checks are distinguished from online estimates. Nutrition is the creator's estimate, not independently calculated.

## Editing and previewing

Recipe content lives in `data/recipes.json`, the dessert shopping list in `data/shopping.json`, and the September 27 Dublin trip in `data/trader-joes.json`. The dependency-free Node build produces static HTML in `dist/`. Recipe pages work without JavaScript; checklist persistence and automatic dessert shopping totals progressively enhance them. The Trader Joe’s checklist has no verified full basket total or live inventory; its product estimates are labeled separately.

```sh
npm ci
npm run check
npm run build
python3 -m http.server 4178 --directory dist
```

Checks are saved in this browser's local storage. They do not sync between devices.

## Publishing

The manual **Deploy Recipes** workflow in [christianwilkins.github.io](https://github.com/christianwilkins/christianwilkins.github.io/actions/workflows/deploy-recipes.yml) builds an explicit commit SHA from this repository and deploys to the `chriswiki-recipes` Cloudflare Pages project. Cloudflare credentials stay in the existing hosting repository; this repository has no deployment secrets. Future edits require another manual deployment.

## Original collection

The original collection was forked from [keshavbabu/recipes](https://github.com/keshavbabu/recipes). Its markdown files are preserved:

- [Korean beef bowl](korean-beef-bowl.md)
- [Three-ingredient mac and cheese](mac-and-cheese.md)
- [Smoothie](smoothie.md)

Original contribution note: if you make a PR, add a picture of the final product.
