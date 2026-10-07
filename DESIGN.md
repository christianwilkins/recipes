---
name: chriswiki recipes
description: A personal recipe notebook with a shared grocery list.
colors:
  bg: "oklch(.98 .008 80)"
  fg: "oklch(.22 .01 260)"
  muted: "oklch(.45 .01 260)"
  line: "oklch(.87 .008 80)"
  surface: "oklch(.94 .008 80)"
  focus: "oklch(.42 .06 250)"
  dark-bg: "oklch(.18 .008 260)"
  dark-fg: "oklch(.92 .008 80)"
  dark-muted: "oklch(.73 .008 80)"
  dark-line: "oklch(.35 .008 260)"
  dark-surface: "oklch(.23 .008 260)"
  dark-focus: "oklch(.76 .06 250)"
typography:
  display:
    fontFamily: 'Charter, "Bitstream Charter", Georgia, serif'
    fontSize: "clamp(2.8rem,5vw,4.75rem)"
    fontWeight: 400
    lineHeight: 1.13
    letterSpacing: "-.025em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    lineHeight: 1.6
  label:
    fontSize: ".875rem"
    fontWeight: 550
    lineHeight: 1.4
rounded:
  control: "8px"
components:
  button-primary:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    typography: "{typography.label}"
  field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: chriswiki recipes

## Overview

**Creative North Star: "A personal recipe notebook"**

This documents the existing implementation in `public/style.css`, `public/app.js`, and `scripts/build.mjs`, including the recipe-prompt extension. Serif headings, system body text, quiet neutral surfaces, and native controls support reading, cooking, and maintaining a grocery list.

**Key Characteristics:**

- Charter headings and system body text.
- Neutral light and dark palettes, thin dividers, and flat surfaces.
- Native controls with visible focus and readable fallback content.

## Colors

The neutral palette uses warm paper backgrounds and dark text in light mode; dark mode reverses their lightness while retaining subdued chroma. `bg` and `fg` define the canvas and text, `muted` supports secondary copy, `line` separates sections, and `surface` groups inset content. `focus` marks keyboard focus. The `dark-` tokens replace their corresponding light values under the system dark-mode preference.

## Typography

Display headings use Charter with Bitstream Charter and Georgia fallbacks. Body copy and controls use the system sans-serif stack. Main headings scale fluidly and become 2.85rem at the narrow breakpoint. Body paragraphs generally stop at 65ch. The recipe-prompt heading uses the existing serif hierarchy at 1.5rem; supporting copy and status use the small muted text treatment.

## Layout

The centered shell is at most 1120px wide, with 48px horizontal padding, reduced to 28px at 900px and 20px at 640px. Recipe indexes and ingredient/method layouts use two columns and collapse to one at 640px. Actions wrap with 16px gaps, reduced to 12px on narrow screens.

The recipe-prompt section sits after the recipe heading and before the ingredients/method. A thin top divider and 28px top/32px bottom padding keep it within the notebook rhythm. Its optional preview has a maximum width of 75ch. The main-site navigation link is a cross-site connection to chriswiki.com.

## Elevation & Depth

The implementation uses no shadows. Thin rules, spacing, and the neutral surface token establish grouping.

## Shapes

Buttons and fields share gently rounded control corners and one-pixel borders. Recipe lists remain open rows rather than raised cards.

## Components

- **Buttons:** primary actions invert foreground and background; secondary actions are transparent with a line-colored border. Both have a minimum height of 44px, reduce opacity on hover, and shift down 1px when pressed. Disabled buttons reduce opacity and show a wait cursor.
- **Fields:** labeled native inputs, selects, and textareas use the canvas background and line-colored border. Textareas resize vertically. Visible focus uses a 3px focus-colored outline with 5px offset; the prompt textarea also receives a 3px-offset outline on focus.
- **Navigation:** small system text with an underline for the current page; the header stacks on narrow screens.
- **Recipe prompt:** “Copy recipe prompt” copies the complete recipe and cooking instructions. “Share prompt…” appears only when native sharing supports the payload. A native details disclosure contains a labeled, read-only, ten-row textarea, available without JavaScript. Copy or share failure opens, focuses, and selects this text for manual copying; share cancellation leaves no error. Status uses a polite live region. Buttons appear only after JavaScript enables them. The entire section is hidden when printing.

## Do's and Don'ts

- **Do** reuse the existing neutral tokens, Charter headings, system body text, and control treatments for this extension.
- **Do** retain native disclosure and manual-copy access to the recipe prompt.
- **Do** preserve the visible focus treatment and polite action feedback.
- **Don't** introduce shadows or new accent colors into the documented notebook extension.
- **Don't** include the recipe-prompt controls or preview in printed recipes.
