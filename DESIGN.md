# DESIGN.md — UTSA College Design Language System (CDLS)

> Portable design reference for UTSA Academic Affairs projects. Drop this file into any repo
> (and point to it from `CLAUDE.md` / `AGENTS.md` / `README.md`) so people and coding agents
> build UI that matches the College DLS.

| | |
|---|---|
| **Source of truth** | Pattern library: <https://utsa-asc.github.io/college-dls/> · Repo: <https://github.com/utsa-asc/college-dls> |
| **Captured from** | CDLS v0.10.0 (build `d636203`, 2026-10-05), Bootstrap 5.3.x |
| **Owner** | Academic Strategic Communications (ASC) Web Team · vpaacomms@utsa.edu |
| **Request changes** | <https://provost.utsa.edu/communications> or GitHub issues on `utsa-asc/college-dls` |

If this file and the live DLS disagree, **the live DLS wins** — update this file.

---

## 1. How to use this file

1. **Inside Cascade CMS on a college site?** Don't hand-build anything — use the CDLS components
   already in Cascade (asset factories / WYSIWYG formats). This file is for everything else.
2. **Building a standalone app, tool, report, or prototype?** Use the tokens and rules below.
   Prefer the drop-in CSS in [§11](#11-drop-in-starter) over inventing new values.
3. **Need a component that doesn't exist?** Follow the request process in [§13](#13-governance--contributing)
   rather than creating a one-off pattern.

---

## 2. Design character

The CDLS is a **Bootstrap 5 system restyled for the UTSA brand**. Its look comes from a few
consistent moves:

- **Navy-dominant, orange-accented.** Navy (`#032044`) carries headings, links, and big color
  blocks; orange is for emphasis, stats, accents, and calls to action.
- **Square corners everywhere.** `border-radius: 0` is the global default.
- **Angles, not curves.** Cards get a clipped (notched) bottom-right corner; action buttons have
  a translucent angled stripe at the right end; section edges and watermarks use diagonals and chevrons.
- **Full-width color bands.** Pages are stacks of full-width sections that alternate
  white → grey → navy → orange backgrounds.
- **Big, warm display type** (Arsenal) over a clean, readable body face (Libre Franklin) at an
  **18px root**.
- **Plain, functional motion.** Hovers swap color with a `0.3s ease-in-out` transition. Nothing bounces.

---

## 3. Color

### 3.1 Brand palette

| Token (SCSS) | Hex | Text class | Background class | Role |
|---|---|---|---|---|
| `$blue` | `#032044` | `.blue` | `.blue-bg` | **Primary.** Headings, links, primary buttons, dark bands |
| `$blue-b` | `#495970` | `.blue-b` | `.blue-b-bg` | Muted navy (secondary dark surfaces) |
| `$blue-c` | `#344C6B` | — | `.blue-c-bg` | Muted navy, alt |
| `$light-blue` | `#C8DCFF` | `.light-blue` | — | Light tint, highlight surfaces |
| `$orange` | `#F15A22` | `.orange` | `.orange-bg` | **Brand orange.** Large display/stat text on navy, decorative accents, borders. **Not for body text on white.** |
| `$orange-a11y` | `#D3430D` | `.orange-a11y` | `.orange-a11y-bg` | **Accessible orange.** Orange text/links/buttons on white. Bootstrap `secondary`. |
| `$white` | `#FFFFFF` | `.white` | `.white-bg` | Default surface |
| `$white-b` | `#F6F6F6` | `.white-b` | `.white-b-bg` | Off-white surface, table background |
| `$grey` | `#DBDEE3` | `.grey` | `.grey-bg` | Cool grey band, link hover background, striped rows |
| `$grey-b` | `#B4B8BC` | `.grey-b` | `.grey-b-bg` | Mid grey |
| `$grey-c` | `#949494` | `.grey-c` | `.grey-c-bg` | Decorative only (fails contrast with white or navy body text at small sizes) |
| `$grey-d` | `#606060` | `.grey-d` | `.grey-d-bg` | Secondary text, dark grey button hover |
| `$grey-e` | `#151515` | `.grey-e` | `.grey-e-bg` | Near-black |
| `$black` | `#000000` | `.black` | — | Rarely used |
| `$blue-highlight` | `#265BF7` | `.blue-highlight` | — | UI highlight (selection, interactive emphasis) |

Body text color in the compiled CSS is `#0C2340` (navy-tinted), not pure black.

### 3.2 Bootstrap theme mapping

```scss
$primary:   #032044; // $blue
$secondary: #D3430D; // $orange-a11y
$light:     #FFFFFF;
$dark:      #032044;
// success/info/warning/danger stay Bootstrap defaults
// (#198754 / #0DCAF0 / #FFC107 / #DC3545). Use them only for status, never for branding.
```

### 3.3 Contrast — which pairs you can use (WCAG 2.1)

| Foreground on background | Ratio | Normal text (4.5) | Large text / UI (3.0) |
|---|---|---|---|
| Navy `#032044` on White | 16.23 | ✅ | ✅ |
| Navy on Off-white `#F6F6F6` | 15.02 | ✅ | ✅ |
| Navy on Grey `#DBDEE3` | 12.03 | ✅ | ✅ |
| Navy on Light blue `#C8DCFF` | 11.70 | ✅ | ✅ |
| Navy on Grey-b `#B4B8BC` | 8.13 | ✅ | ✅ |
| White on Muted navy `#344C6B` | 8.78 | ✅ | ✅ |
| White on Muted navy `#495970` | 7.13 | ✅ | ✅ |
| Grey-d `#606060` on White | 6.29 | ✅ | ✅ |
| Blue highlight `#265BF7` on White | 5.35 | ✅ | ✅ |
| Orange `#F15A22` on Navy | 4.81 | ✅ | ✅ |
| Navy on Orange `#F15A22` | 4.81 | ✅ | ✅ |
| **Orange-a11y `#D3430D` on White** | 4.59 | ✅ (just) | ✅ |
| **White on Orange-a11y** | 4.59 | ✅ (just) | ✅ |
| Orange-a11y on Navy | 3.54 | ❌ | ✅ |
| Orange-a11y on Grey `#DBDEE3` | 3.40 | ❌ | ✅ |
| **Orange `#F15A22` on White** | 3.37 | ❌ | ✅ |
| **White on Orange `#F15A22`** | 3.37 | ❌ | ✅ |
| White on Grey-c `#949494` | 3.03 | ❌ | ✅ (barely) |

**Rules that follow from this:**
- On **white/light**, use `#D3430D` for any orange text, link, or button fill. Keep `#F15A22`
  for decoration, borders, and large display text.
- On **navy**, use the brighter `#F15A22` for orange text (the a11y orange is *less* readable on navy).
- Don't put small orange-a11y text on the grey band. Use navy text there.
- White text on a `#F15A22` background is large-text-only. For buttons and banners with
  normal-size white text, use `.orange-a11y-bg`.

---

## 4. Typography

### 4.1 Families

| Use | Family | Stack | Source |
|---|---|---|---|
| Headings & display | **Arsenal** | `"arsenal", sans-serif` | Adobe Fonts kit `pgb6ypz` |
| Body & UI | **Libre Franklin** | `"libre-franklin", "Helvetica", "Helvetica Neue", system-ui, -apple-system, Arial, sans-serif` | Adobe Fonts kit `pgb6ypz` |
| Stats / big numerals / dates (legacy) | Kulturista | `"kulturista-web", serif` | Adobe Fonts (slated for removal post-rebrand) |
| Code | System mono | `SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` | System |

```html
<!-- Only serves fonts on *.utsa.edu domains -->
<link rel="stylesheet" href="https://use.typekit.net/pgb6ypz.css">
```

**Off `*.utsa.edu` (localhost, GitHub Pages, internal tools):** the Adobe kit and Font Awesome Pro
won't load. Arsenal and Libre Franklin are both on Google Fonts, so use them as a fallback.
Declare the family names so the stacks still resolve:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Arsenal:wght@400;700&family=Libre+Franklin:wght@300;400;600;700&display=swap">
```
```css
/* Google names them "Arsenal" / "Libre Franklin"; Adobe uses lowercase-hyphenated names. */
:root {
  --font-heading: "arsenal", "Arsenal", sans-serif;
  --font-body: "libre-franklin", "Libre Franklin", "Helvetica Neue", Helvetica, system-ui, Arial, sans-serif;
}
```
For stats, use Arsenal 700 instead of Kulturista.

### 4.2 Scale (root = 18px, so 1rem = 18px)

| Element | Size | px | Weight | Family | Color (light) |
|---|---|---|---|---|---|
| `.display-1` | 4rem | 72 | 600 | Arsenal | Navy, lh 1 |
| `.display-2` | 3.75rem | 67.5 | 600 | Arsenal | Navy, lh 1.2 |
| `.display-3` | 3.5rem | 63 | 600 | Arsenal | Navy, lh 1.2 |
| `.display-4` | 3.25rem | 58.5 | 400 | Arsenal | Navy, lh 1.2 |
| `.display-5` | 3rem | 54 | 400 | Arsenal | Navy, lh 1.3 |
| `.display-6` | 2.75rem | 49.5 | 400 | Arsenal | Navy, lh 1.3 |
| `h1` / `.h1` | 2.5rem | 45 | 700 | Arsenal | Navy |
| `h2` / `.h2` | 2.25rem | 40.5 | 700 | Arsenal | Navy |
| `h3` / `.h3` | 2rem | 36 | 700 | Arsenal | Navy |
| `h4` / `.h4` | 1.75rem | 31.5 | 700 | Arsenal | Navy |
| `h5` / `.h5` | 1.5rem | 27 | 700 | Arsenal | Navy |
| `h6` / `.h6` | 1.25rem | 22.5 | 700 | Arsenal | Navy |
| Quickfact stat | 4rem | 72 | 700 | Kulturista → Arsenal | Orange |
| Banner description | 1.25rem | 22.5 | 300 | Libre Franklin | White on dark |
| `.lead` | 1.25rem | 22.5 | 300 | Libre Franklin | Body |
| `.intro` | 1.125rem | 20.25 | 400 | Libre Franklin | Body, lh 1.5 |
| Body `p` | 1rem | 18 | 400 | Libre Franklin | `#0C2340`, lh 1.5 |
| Buttons | 0.9rem | ~16 | 600 | Libre Franklin | — |
| Eyebrow / month label | 1rem | 18 | 400 | Libre Franklin | UPPERCASE, `letter-spacing: 2px` |
| `code` | 0.875rem | 15.75 | — | Mono | Navy |

Headings: `line-height: 1.2`, `margin-bottom: .5rem`. On screens below `lg`, `.paragraph-text`
drops to `.875rem` / `line-height 1.6`.

### 4.3 Links

```css
a              { color: #032044; text-decoration: underline; }
a:hover,
a:focus,
a:active       { color: #032044; background-color: #DBDEE3; transition: all .3s ease-in-out; }
.orange-anchor { color: #D3430D; text-decoration: underline; }   /* hover → navy on grey */
.grey-anchor   { color: #032044; background: #DBDEE3; }           /* hover → grey on navy */
.view-all-link { color: #032044; font-size: 1rem; }               /* + orange-a11y arrow icon */
```
Links stay **underlined** in body copy. The hover state is a grey "highlighter" background,
not a color change.

---

## 5. Layout

### 5.1 Breakpoints (custom: adds `xxs` and `xs`)

| Name | Min width |
|---|---|
| `xxs` | 0 |
| `xs` | 375px |
| `sm` | 576px |
| `md` | 768px |
| `lg` | 992px |
| `xl` | 1200px |
| `xxl` | 1400px |

### 5.2 Grid and containers

- Bootstrap 12-column grid, `$grid-gutter-width: 1.5rem` (27px).
- `$container-padding-x: 1.5rem`. Container side padding is 0.99 × gutter at `sm`/`md` and
  0.5 × gutter at `lg` and up.
- Observed `.container` max-width at a 1280px viewport: **1170px**.

### 5.3 Vertical rhythm

- Pages are **stacks of full-width sections**. Each section owns its background color and
  wraps its content in a `.container`.
- Standard section padding: **`py-5`** = 3rem = **54px** top and bottom (`py-3 py-md-5` to tighten on mobile).
- Dense bands (quickfacts) use ~30–40px.
- Don't put two sections with the same background next to each other unless they read as one block.

### 5.4 Spacing

Use Bootstrap's spacer scale (because rem = 18px: `1`=4.5px, `2`=9px, `3`=18px, `4`=27px,
`5`=54px). Avoid magic pixel values. Legacy vendor utility classes in the DLS
(`03-utility/width`, `misc`) are **not recommended for new work**. Use Bootstrap utilities.

---

## 6. Shape, surface & pattern

| Property | Value |
|---|---|
| Border radius | **0** (global). Bootstrap `-sm/-lg/-xl` radii exist but go unused. Pills only for status badges. |
| Shadows | Bootstrap defaults (`0 .5rem 1rem rgba(0,0,0,.15)`). Use sparingly; the system is flat. |
| Card accent | `border-top: 6px solid #F15A22` on event/deadline cards |
| Transition | `all 0.3s ease-in-out` |

### 6.1 Notched corner (signature card shape)

```css
.notched {
  --notchSize: 3.8rem;
  clip-path: polygon(100% 0, 100% calc(100% - var(--notchSize)),
                     calc(100% - var(--notchSize)) 100%, 0 100%, 0 0);
}
```
Used on content/highlight cards, event (deadline) cards, and news cards. The bottom-right corner
is clipped. Images in image+text sections use the same idea on the top-right corner.

### 6.2 Diagonal stripe pattern

```css
.stripe-bg {
  background: repeating-linear-gradient(45deg,
    rgba(0,0,0,0), rgba(0,0,0,0) 2px, rgba(0,0,0,.1) 4px, rgba(0,0,0,0) 7px);
}
/* Combine with a color: <section class="blue-bg stripe-bg"> */
```

### 6.3 Chevron / diagonal motifs

Quickfacts get a large translucent up-chevron watermark automatically. Banners and band
transitions use angled edges. Keep these decorative: `aria-hidden`, no content inside them.

---

## 7. Components

### 7.1 Buttons (standard)

All standard buttons: `display:inline-block; padding:10px 15px; min-width:168px; font-weight:600;
font-size:.9rem; text-align:center; text-decoration:none; margin-bottom:15px; border-radius:0`.

| Class | Default | Hover |
|---|---|---|
| `.blue-btn` (default) | navy bg / white text | orange-a11y bg / white |
| `.orange-btn` | orange-a11y bg / white | navy bg / white |
| `.grey-btn` | grey bg / navy text | grey-d bg / white |
| `.white-btn` | white bg / navy text | navy bg / white |

**Same-color rule:** a button never sits on a background of its own color. On `.blue-bg`,
`.blue-btn` becomes white with navy text. On `.orange-a11y-bg`, `.orange-btn` becomes navy.
Apply the same logic to any new component.

Bootstrap `.btn-primary` and `.btn-secondary` map to navy and orange-a11y if you use stock Bootstrap markup.

### 7.2 Angled action button (signature CTA)

```html
<div class="orange-action-btn">            <!-- or .blue-action-btn, .orange-action-large-btn, .blue-action-large-btn -->
  <a href="/apply" class="action-btn">Apply now <i class="fas fa-arrow-right" aria-hidden="true"></i></a>
</div>
```
- Full-width flex row: label left, arrow icon right. `padding:13px 15px 13px 24px`, `.875rem`.
  Large variant: `22px` vertical padding, `1rem`/600.
- `::after` draws a translucent white (`rgba(255,255,255,.2)`) angled block behind the arrow on the right end.
- Colors: orange-a11y ↔ navy swap on hover. Only orange and blue variants exist.
- Used inside Action Cards, CTA sections, and RFI blocks.

### 7.3 Cards

| Card | Use | Image spec |
|---|---|---|
| Action card | 3-up grid: image, headline, blurb, link | 460×210 |
| Content (highlight) card | 3–4-up, notched corner | 460×210 |
| Event (deadline) card | Orange top border, uppercase month (2px tracking), big orange date, notched corner | 460×210 |
| News card | 3–4-up grid | displays at size |
| Profile card | Faculty grids only. Default = white bg / orange name. Alt = navy bg / white | 400×500 headshot |

Cards are **never used standalone**. They always live inside a group section (Action Group,
Content List, News Group, Event Group, Faculty Group). Keep headline and blurb lengths
**consistent across a row** so the grid doesn't look ragged.

### 7.4 Section catalog

| Section | Purpose / notes |
|---|---|
| Global header + Site navigation | Required on every page. Navy UTSA bar, college name, mega-nav, Request Info / Visit / Apply tabs on orange. |
| Breadcrumb | All interior pages, before content |
| Side navigation | Sub-section (department) navigation |
| Banner | Top of page. Home (1600×800), alternate (1600×500), interior (640×380). Rotating banners need a CTA on every slide. |
| CTA – buttons | Short headline + optional message + 1 (max 2) actions |
| CTA – media | Same as above plus left/right image (600×400) |
| Enrollment CTA | Bottom of every page, before footers (1600×500) |
| Content groups | Action / content / news / event / profile groups, link list, faculty slider |
| Quickfacts | 1–5 stats (6 max), no links, **one per page**. Variants: white, grey, orange, blue. |
| Content callout / Icon callout / Image collage | Full-width feature bands. Collage text box must not match the background color. |
| Blockquote | 4 variants, optional headshot (420×280) |
| Accordion, Tabs | Bootstrap-based, full width |
| Gallery | Thumbnails 360×200, full-size 1200×670, opens in a modal |
| Timeline | Full-width chronological band |
| Site ankle + Site footer + Global footer | Contact info, then the UTSA footer. **Don't change footer background colors.** |

### 7.5 Color-variant convention

When a component supports multiple backgrounds, name the variant by its **background color**
and order variants: **white (Default) → grey → blue → orange**. The first variant is always "Default".

### 7.6 Tables

- Default: `th` bold, orange text. Table bg `#F6F6F6`, border navy.
- Striped: `.table-design` (orange `thead`), `.table-design-blue`, `.table-design-grey`.
  Stripes use `#DBDEE3`.
- Wrap wide tables in `.medium-headline-table` for horizontal scroll on mobile.
- Tables are for data only. No layout tables, and no images or video inside tables.
- Always use `<th scope="col|row">`.

### 7.7 Forms

Inputs and selects are square (`border-radius:0`). Selects use `12px 15px` padding (Select2 /
Tom Select styling: white control, grey-c active option with white text).

---

## 8. Iconography & imagery

- **Icons:** Font Awesome Pro 6 (Solid, Regular, Brands, Duotone, Sharp Duotone) through a kit
  that only works on `*.utsa.edu`. Off-domain, fall back to **Font Awesome Free 6** with the same
  class names (`fas fa-arrow-right`). Decorative icons always get `aria-hidden="true"`.
- **Directional arrow** (`fa-arrow-right`) is the standard "go" affordance on CTAs and "View all" links.
- **Images:** JPEG/PNG at 72 ppi. Most images ≤ **300 KB**, full-width banners ≤ **500 KB**.
  Always use the spec sizes in §7 so crops stay consistent.
- Brand assets (logos, arrow SVGs, the Roadrunner mark) live in the DLS `public/utsa/images/`.
  Don't redraw or recolor UTSA logos. Use official files only.

---

## 9. Dark mode

- Uses Bootstrap's `data-bs-theme="light|dark"` on `<html>`, with a Light / Dark / Auto toggle
  (`color-modes.js`, stored in `localStorage`, Auto follows `prefers-color-scheme`).
- Dark body: bg `#212529`, text `#DEE2E6`. Headings, paragraphs, list items, and links switch to white.
- **Colored bands keep their colors.** Inside `.grey-bg`, `.orange-bg`, and `.white-bg` in dark mode,
  text switches back to navy so it stays readable.
- If you write custom components, test both themes, and scope overrides with
  `[data-bs-theme=dark] .your-thing { … }` (SCSS: `@include color-mode(dark) { … }`).

---

## 10. Accessibility requirements

The DLS's acceptance criteria require WCAG 2.1 AA ("ADA/Accessibility compliance").

- Follow the contrast rules in §3.3. Orange-a11y on white is only 4.59:1, so don't lighten it.
- **Link text must be descriptive.** Never "Click here" or "Learn more" on its own.
- Every content image needs meaningful `alt`. Headshots name the person.
  Decorative shapes, chevrons, and patterns get `alt=""` / `aria-hidden`.
- One `h1` per page, headings in order. Quickfacts stats are `h2` plus a `p`.
- Linked PDFs (e.g., CVs) must be accessible documents.
- Respect `prefers-reduced-motion` for carousels and sliders, and always give rotating banners a pause control.

**Known gaps in the upstream CSS. Fix these in your own projects:**
1. `button:focus { outline: none; }` removes the focus ring. Add a visible one:
   ```css
   :where(a, button, [role="button"], input, select, textarea, summary):focus-visible {
     outline: 3px solid #265BF7; outline-offset: 2px;
   }
   .blue-bg :focus-visible, .orange-a11y-bg :focus-visible { outline-color: #FFFFFF; }
   ```
2. Button hovers on colored bands go to grey-c (`#949494`) with white text, which is 3.03:1.
   Prefer grey-d (`#606060`, 6.29:1) for new work.
3. `.orange-anchor` on `.grey-bg` is 3.40:1. Use navy links on grey.

---

## 11. Drop-in starter

### 11.1 CSS custom properties (framework-agnostic)

```css
:root {
  /* Brand */
  --utsa-navy: #032044;
  --utsa-navy-muted: #495970;
  --utsa-navy-muted-2: #344C6B;
  --utsa-light-blue: #C8DCFF;
  --utsa-orange: #F15A22;        /* decorative / large / on-navy */
  --utsa-orange-a11y: #D3430D;   /* text, links, buttons on light */
  --utsa-white: #FFFFFF;
  --utsa-off-white: #F6F6F6;
  --utsa-grey: #DBDEE3;
  --utsa-grey-b: #B4B8BC;
  --utsa-grey-c: #949494;
  --utsa-grey-d: #606060;
  --utsa-grey-e: #151515;
  --utsa-highlight: #265BF7;

  /* Semantic */
  --color-text: #0C2340;
  --color-heading: var(--utsa-navy);
  --color-link: var(--utsa-navy);
  --color-link-hover-bg: var(--utsa-grey);
  --color-accent: var(--utsa-orange-a11y);
  --color-surface: var(--utsa-white);
  --color-surface-alt: var(--utsa-grey);
  --color-surface-inverse: var(--utsa-navy);
  --color-focus: var(--utsa-highlight);

  /* Type */
  --font-heading: "arsenal", "Arsenal", sans-serif;
  --font-body: "libre-franklin", "Libre Franklin", "Helvetica Neue", Helvetica, system-ui, Arial, sans-serif;
  --font-mono: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 18px;               /* root — 1rem = 18px */

  /* Shape & motion */
  --radius: 0;
  --notch: 3.8rem;
  --card-accent: 6px solid var(--utsa-orange);
  --transition: all .3s ease-in-out;

  /* Rhythm */
  --gutter: 1.5rem;
  --section-pad: 3rem;           /* = Bootstrap py-5 at 18px root */
}

[data-bs-theme="dark"] {
  --color-text: #DEE2E6;
  --color-heading: #FFFFFF;
  --color-link: #FFFFFF;
  --color-surface: #212529;
}

body { font-family: var(--font-body); color: var(--color-text); background: var(--color-surface); line-height: 1.5; }
h1, h2, h3, h4, h5, h6 { font-family: var(--font-heading); font-weight: 700; color: var(--color-heading); line-height: 1.2; }
```

### 11.2 Bootstrap 5 SCSS overrides

```scss
// _utsa-variables.scss — import BEFORE bootstrap
$blue: #032044;  $orange: #F15A22;  $orange-a11y: #D3430D;
$grey: #DBDEE3;  $white-b: #F6F6F6;

$primary: $blue;  $secondary: $orange-a11y;  $light: #FFFFFF;  $dark: $blue;

$font-family-sans-serif: "libre-franklin", "Helvetica", "Helvetica Neue", system-ui, -apple-system, Arial, sans-serif;
$headings-font-family: "arsenal", sans-serif;
$headings-font-weight: 700;
$font-size-root: 18px;
$display-font-sizes: (1: 4rem, 2: 3.75rem, 3: 3.5rem, 4: 3.25rem, 5: 3rem, 6: 2.75rem);

$grid-breakpoints: (xxs: 0, xs: 375px, sm: 576px, md: 768px, lg: 992px, xl: 1200px, xxl: 1400px);
$grid-gutter-width: 1.5rem;
$container-padding-x: 1.5rem;

$border-radius: 0;  $input-border-radius-sm: 0;  $input-border-radius-lg: 0;
$table-bg: $white-b;  $table-striped-bg: $grey;  $table-border-color: $blue;
$min-contrast-ratio: 4.5;
```

### 11.3 Using the built DLS directly (prototypes on `*.utsa.edu`)

```html
<link rel="stylesheet" href="https://utsa-asc.github.io/college-dls/college-dls/css/site.css">
<script src="https://utsa-asc.github.io/college-dls/college-dls/js/bundle/college-dls-umd.js"></script>
```
This is fine for prototypes. For production, build from the repo (`npm run build` → `dist/`)
or use the Cascade implementation. Don't hotlink GitHub Pages in production.

---

## 12. Content & copy rules

- Headlines: short. Keep lengths consistent across cards in the same row.
- CTA labels: verb-first and specific ("Request information", "Explore programs"). Don't let them wrap.
- One primary CTA per section. Two at most.
- Quickfacts: real, sourced numbers, one section per page, and not on every page.
- Tables only for tabular data (tuition, fees, schedules).
- Contact info belongs in the Site Ankle/Footer, right before the global UTSA footer.

---

## 13. Governance & contributing

**Component lifecycle**

| State | Meaning |
|---|---|
| `prototype` | Proof of concept. **Do not implement.** |
| `wip` | Design stable, markup may change. Implement with caution. |
| `ready` | Done. Safe to use in mockups and builds. Required before merging to `main`. |
| `exported` | Live in Cascade sites and release packages |

**Request process (summary):** request (ASC form or Teams) → research → wireframe → mockup →
stakeholder review → CDLS integration (wip) → testing, responsive and a11y QA (ready) →
Cascade integration → demo/training → documentation (exported) → announce.

**Repo conventions** (if you contribute upstream):
- One folder per component (`NN-component-name/`) containing `.hbs`, `.config.json`, `.scss`, `.readme.md`.
- First variant is `Default`. Variants are named for their background color, in the order white → grey → blue → orange.
- Branches: `feature-…`, `sprint-NN-…`, `bug-…` / `hotfix-…`. One component per PR where possible.
- Every component readme should cover: When to use / When to consider something else /
  Accessibility notes / Cascade usage / Variants / Media requirements / Copy requirements.

---

## 14. Agent checklist

Before shipping UI in a UTSA project, confirm:

- [ ] Colors come only from §3. Orange text on light backgrounds uses `#D3430D`.
- [ ] Headings use Arsenal 700 in navy. Body uses Libre Franklin at an 18px root.
- [ ] Corners are square. Cards use the notched corner where a "card" look is wanted.
- [ ] Buttons are the §7.1/§7.2 styles, never sit on their own color, and hover with a 0.3s color swap.
- [ ] Sections are full-width bands with `py-5` rhythm, and adjacent bands differ in color.
- [ ] Links are underlined, descriptive, and use the grey highlight on hover.
- [ ] A visible `:focus-visible` ring is present (upstream removes it, so add it back).
- [ ] Dark mode is checked if the page has the theme toggle.
- [ ] Images match the size specs and stay under 300 KB (500 KB for banners).
- [ ] Off `*.utsa.edu`, the Google Fonts and FA Free fallbacks are wired up.
- [ ] Nothing here contradicts the live DLS. If it does, the DLS wins and this file gets updated.
