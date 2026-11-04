# Style guide

Rules for every page of this site. The tokens live in `css/styles.css` under
`:root`. Read a value from a token. Never write a raw hex value or a raw font
name in a page, a component, or a JavaScript file.

The colors and the fonts below are placeholders. Swap the token values when the
final palette and the final typefaces arrive. Nothing else needs to change.

## Corners

Corners are sharp. `border-radius` stays at `0`.

Three exceptions exist, and each one is named here:

| Exception | Token | Where |
|---|---|---|
| A circle | `--radius-circle` | The loading spinner |
| A pill | `--radius-pill` | None at present |
| A hairline round | `--radius-soft` | None at present |

To add an exception, add the element to this table first.

## Color

Four colors carry the site. Every other value is one of them, lightened or
darkened. There is no second theme.

| Palette token | Value | Name |
|---|---|---|
| `--teal` | `#17808f` | Teal |
| `--space-indigo` | `#192a51` | Space Indigo |
| `--alice-blue` | `#e2eefa` | Alice Blue |
| `--amethyst-smoke` | `#aa78a6` | Amethyst Smoke |

Teal is the main color. It fills the primary button, the menu rail, the drawer,
and the closing band.

Amethyst Smoke is a mark, not a surface. It colors the home page tagline, an
eyebrow, a section number, the rule under a section heading, a chip border, a
focus ring, and a hover edge. It never fills a button, a rail, or a band.

Never read a palette token in a component. Read a role token:

| Role token | Comes from | Use |
|---|---|---|
| `--color-bg` | Alice Blue | The page behind everything |
| `--color-surface` | Alice Blue, lightened | A card, a tile, a panel, an input |
| `--color-surface-alt` | Alice Blue, darkened | A quiet block |
| `--color-ink` | Space Indigo | Body text and headings |
| `--color-ink-muted` | Space Indigo, lightened | A caption, a date, a count |
| `--color-line` | Alice Blue, darkened | A border or a divider |
| `--color-brand` | Teal | The rail, the drawer, the band, dark end |
| `--color-brand-light` | Teal, lightened | Those gradients, light end |
| `--color-brand-dark` | Teal, darkened | A hover on teal |
| `--color-brand-soft` | Teal over Alice Blue | A quiet hover fill |
| `--color-on-brand` | Alice Blue, lightened | Text on teal or on the error red |
| `--veil-on-brand` | Alice Blue, see through | A hover fill on teal |
| `--color-accent` | Teal | The primary action |
| `--color-accent-hover` | Teal, darkened | That action, hovered |
| `--color-on-accent` | Alice Blue, lightened | Text on the primary action |
| `--color-mark` | Amethyst Smoke | A tagline, an eyebrow, a section number, a rule, a focus ring, a hover edge, the About accent block, the gallery Add button |
| `--color-mark-dark` | Amethyst, darkened | That Add button, hovered |
| `--color-mark-soft` | Amethyst over Alice Blue | A chip fill |
| `--color-error` | A brick red | A required marker, an invalid field |
| `--color-overlay` | Space Indigo, see through | A scrim behind a drawer or a modal |
| `--blank-1` .. `--blank-8` | Tints of the four | A placeholder tile, when the image API is down |

Rules:

1. Text on `--color-bg` or `--color-surface` uses `--color-ink`.
2. Text on teal uses `--color-on-brand`. Teal is dark.
3. Amethyst colors text, rules and borders. One button carries it: Add, on the
   gallery search page. A filter that takes focus shows the same color, so the
   control and its action match. Nothing else fills with amethyst.
4. A border uses `--color-line`, or `--color-mark` on a chip.
5. To change the look, edit the four palette values. Nothing else.

## Type

Two families. One for display, one for reading.

| Token | Stack | Use |
|---|---|---|
| `--font-display` | `'Helvetica Neue', Helvetica, Arial, sans-serif` | Headings, buttons, menu links, labels |
| `--font-body` | `Georgia, 'Times New Roman', serif` | Paragraphs, captions, image metadata |

Sizes come from the scale. Do not invent a size between two steps.

| Token | Size | Use |
|---|---|---|
| `--text-xs` | 12px | A caption or a count |
| `--text-sm` | 14px | A chip, a small label |
| `--text-md` | 16px | Body copy, an input |
| `--text-lg` | 20px | A card heading |
| `--text-xl` | 32px | A page heading |
| `--text-display` | `clamp(1.9rem, 5.2vw, 3.9rem)` | The name on the home page |

A heading and a button use uppercase with `letter-spacing: 0.06em`.

## Space

One 4px scale. Every margin, padding, and gap uses a step.

`--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px,
`--space-5` 24px, `--space-6` 32px, `--space-7` 48px, `--space-8` 64px.

The photo wall is the one place with a fixed pixel gutter. It is 3px, and
`js/mosaic.js` owns it.

## Side menu

The side menu is a standard drawer. Every page that has a menu uses this
behavior:

1. A hamburger button sits at the top left, above the drawer.
2. The teal rail sits behind the button and fades out to the right.
3. The drawer slides in from the left over 240ms.
4. A scrim covers the rest of the page and dims it.
5. A click on the scrim, a press of Escape, or a click on the button closes it.

Focus moves to the first link when the drawer opens. Focus returns to the
button when the drawer closes. The button carries `aria-expanded` and
`aria-controls`.

## Forms

A required field carries a red asterisk after its label text:

```html
<label class="form-label" for="name">Name <span class="required" aria-hidden="true">*</span></label>
```

The control also carries the `required` attribute, for a screen reader. A page
with a required field states the rule once, above the form.

A submit that fails validation does three things: it marks the first bad
control with `is-invalid`, it moves focus there, and it writes one sentence to
the status line. It never clears what the person typed.

The server repeats every required check. A direct POST must not skip one.

## JavaScript

No inline style objects with colors, fonts, or sizes. A component sets a class
name, and `css/styles.css` holds the rule. A value a script computes at
runtime, such as a tile position, is passed as a custom property.
