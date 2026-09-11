# Recipes

A personal recipe notebook at [recipes.chriswiki.com](https://recipes.chriswiki.com).

- [Protein banana pudding](https://recipes.chriswiki.com/protein-banana-pudding/)
- [Biscoff protein cheesecake bowl](https://recipes.chriswiki.com/biscoff-protein-cheesecake-bowl/)
- [Combined shopping checklist](https://recipes.chriswiki.com/shopping/)

The two dessert recipes are adapted from Prep with Drew's Instagram captions, linked on each page. Shopping prices are dated September 11, 2026; local pickup checks are distinguished from online estimates. Nutrition is the creator's estimate, not independently calculated.

## Editing and previewing

Recipe content lives in `data/recipes.json`, and the shopping list in `data/shopping.json`. The dependency-free Node build produces static HTML in `dist/`. Recipe pages work without JavaScript; checklist persistence and automatic shopping totals progressively enhance them.

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
