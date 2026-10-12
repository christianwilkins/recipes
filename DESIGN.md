---
name: chriswiki recipes
description: The recipe notebook and shared grocery list at recipes.chriswiki.com, styled as part of chriswiki.com.
colors:
  bg: "oklch(.965 0 0)"
  fg: "oklch(.2 0 0)"
  muted: "oklch(.5 0 0)"
  line: "oklch(.86 0 0)"
  surface: "oklch(.93 0 0)"
  accent: "oklch(.9 0 0)"
  dark-bg: "oklch(0 0 0)"
  dark-fg: "oklch(.82 0 0)"
  dark-muted: "oklch(.62 0 0)"
  dark-line: "oklch(.24 0 0)"
  dark-surface: "oklch(.14 0 0)"
  dark-accent: "oklch(.2 0 0)"
typography:
  display:
    fontFamily: '"Plantin", "Plantijn", "Newsreader", Georgia, serif'
    fontSize: "clamp(2rem,4vw,2.25rem)"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif'
    fontSize: "16.96px"
    lineHeight: 1.7
  label:
    fontSize: ".875rem"
    fontWeight: 500
rounded:
  control: ".35rem"
  pill: "999px"
---

# Design System: chriswiki recipes

## Overview

Recipes is a subdomain of chriswiki.com, so it borrows the main site's default "Chimero noir" preset (`src/lib/style-config.ts` and `src/app/theme.css` in christianwilkins.github.io). The implementation lives in `public/style.css` and the templates in `scripts/build.mjs`. If the main site's default preset changes, update the tokens here to match.

## Colors

A greyscale palette with no accent hue. Light mode uses a pale grey canvas and near black text; dark mode uses a black canvas and light grey text. Dark muted text is lifted slightly above the main site's value so small text keeps readable contrast on black.

## Typography

Headings and navigation use Newsreader, with Plantin first for people who have it installed, matching the main site. Body copy and controls use IBM Plex Sans. Both load from the same Google Fonts request the main site uses. Picker legends are small uppercase muted labels.

## Layout

A sticky top bar holds "Christian Wilkins" (linking to chriswiki.com), the "Recipes" role, and pill links. Content is centered at 58rem. Index sections, nutrition, the agent prompt, and recipe variations use split rows: a label column on the left and content on the right, separated by thin rules, as on the main site's home page. The ingredients and method keep their own two columns. Below 760px everything stacks and the nav sits on its own row under the brand without wrapping.

## Components

- **Buttons:** primary buttons invert foreground and background; secondary buttons are transparent with a line border. Both are at least 44px tall.
- **Pickers:** option choices (filling, beans) and batch size are native radio fieldsets styled as segmented buttons. The checked option gets the foreground border. Variant content is switched with CSS, so it works without JavaScript; batch size appears only when JavaScript can rescale the text.
- **Nutrition:** a plain table with per serving and whole batch columns, followed by a small note listing the data source, assumptions, and ingredients left out.
- **Recipe prompt:** copy and share buttons plus a native disclosure with the read only prompt, which follows the selected options and batch size. Hidden in print.
- **Print:** hides navigation, pickers, and the prompt, and prints a line naming the selected option and batch size.

## Do's and Don'ts

- **Do** keep the greyscale palette, serif headings, and pill navigation consistent with chriswiki.com.
- **Do** keep every picker usable by keyboard with a visible focus outline.
- **Don't** add accent colors, shadows, or decoration the main site's default preset does not use.
- **Don't** let the header navigation wrap onto a second row.
