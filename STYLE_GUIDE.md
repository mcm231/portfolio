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

One palette serves every page. There is no second theme.

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#eef4fe` | The page behind everything |
| `--color-surface` | `#ffffff` | A card, a tile, a panel |
| `--color-surface-alt` | `#dde7f5` | An input, a hover state, a chip |
| `--color-ink` | `#111a2b` | Body text and headings |
| `--color-ink-muted` | `#5f7391` | A caption, a date, a count |
| `--color-ink-invert` | `#ffffff` | Text on brand or accent |
| `--color-line` | `#c3d2e6` | A border or a divider |
| `--color-accent` | `#6c5ce7` | The primary action |
| `--color-accent-hover` | `#5a49d6` | That action, hovered |
| `--color-brand` | `#17808f` | The menu rail, dark end |
| `--color-brand-light` | `#4ea8c9` | The menu rail, light end |
| `--color-error` | `#c1121f` | A required marker, an invalid field, an error line |
| `--color-overlay` | `rgba(17, 26, 43, 0.55)` | A scrim behind a drawer or a modal |
| `--blank-1` .. `--blank-8` | blue tints | A placeholder tile, when the image API is down |

Rules:

1. Text on `--color-bg` or `--color-surface` uses `--color-ink`.
2. Text on `--color-brand` or `--color-accent` uses `--color-ink-invert`.
3. A border uses `--color-line`. Do not use a transparent white border.

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
