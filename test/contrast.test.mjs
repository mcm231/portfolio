// Contrast audit. Reads the tokens straight out of public/css/tokens.css and
// checks every foreground on background pair the site actually paints.
//
// WCAG 2.1 AA: 4.5 to 1 for normal text, 3 to 1 for large text and for a
// component boundary such as a border or a focus ring.
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../public/css/tokens.css', import.meta.url), 'utf8');

// Pull every custom property out of the :root block.
const root = CSS.slice(CSS.indexOf(':root {'));
const raw = new Map();
for (const [, name, value] of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    raw.set(name, value.trim());
}

// Resolve a value that points at another token.
function resolve(name, seen = new Set()) {
    if (seen.has(name)) throw new Error(`Token loop at ${name}`);
    seen.add(name);

    const value = raw.get(name);
    if (!value) throw new Error(`Unknown token ${name}`);

    const ref = value.match(/^var\((--[\w-]+)\)$/);
    return ref ? resolve(ref[1], seen) : value;
}

function toRgb(value) {
    const hex = value.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
        const n = parseInt(hex[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const rgba = value.match(/rgba?\(([^)]+)\)/);
    if (rgba)
        return rgba[1]
            .split(',')
            .slice(0, 3)
            .map(p => Number(p.trim()));
    throw new Error(`Cannot read the color ${value}`);
}

function luminance(value) {
    const [r, g, b] = toRgb(value).map(channel => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(aToken, bToken) {
    const a = luminance(resolve(aToken));
    const b = luminance(resolve(bToken));
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
}

// Every pair the stylesheet paints. "large" covers text at 24px or more, and
// text at 19px or more when bold. "ui" covers a border, a rule or a focus ring.
const PAIRS = [
    ['body text on the page', '--color-ink', '--color-bg', 'normal'],
    ['body text on a card', '--color-ink', '--color-surface', 'normal'],
    ['body text on a quiet block', '--color-ink', '--color-surface-alt', 'normal'],
    ['a caption on the page', '--color-ink-muted', '--color-bg', 'normal'],
    ['a caption on a card', '--color-ink-muted', '--color-surface', 'normal'],

    ['button text on teal', '--color-on-accent', '--color-accent', 'normal'],
    ['button text, hovered', '--color-on-brand', '--color-accent-hover', 'normal'],
    ['menu text, drawer top', '--color-on-brand', '--color-brand-deep', 'normal'],
    ['menu text, drawer base', '--color-on-brand', '--color-brand-dark', 'normal'],
    ['the hamburger on the rail', '--color-on-brand', '--color-brand', 'ui'],
    ['band text, dark end', '--color-on-brand', '--color-brand-dark', 'large'],
    ['band text, light end', '--color-on-brand', '--color-brand', 'large'],
    ['the band button text', '--color-brand-dark', '--color-on-brand', 'normal'],
    ['that button, hovered', '--color-brand-dark', '--color-brand-soft', 'normal'],
    ['the quiet hover text', '--color-ink', '--color-brand-soft', 'normal'],

    ['the Add button text', '--color-on-brand', '--color-mark-fill', 'normal'],
    ['the Add button, hovered', '--color-on-brand', '--color-mark-fill-hover', 'normal'],
    ['the tagline on a card', '--color-mark-text', '--color-surface', 'normal'],
    ['the eyebrow on the page', '--color-mark-text', '--color-bg', 'normal'],
    ['a section number, page', '--color-mark-text', '--color-bg', 'normal'],
    ['chip text on a chip', '--color-ink', '--color-mark-soft', 'normal'],
    ['text on a medium pill', '--color-ink', '--pill-medium-fill', 'normal'],
    ['text on a tag pill', '--color-ink', '--pill-tag-fill', 'normal'],
    ['a medium outline on its fill', '--pill-medium-line', '--pill-medium-fill', 'decor'],
    ['a tag outline on its fill', '--pill-tag-line', '--pill-tag-fill', 'decor'],
    ['a caption on the palest photo', '--color-on-brand', '--color-scrim-flat', 'normal'],
    ['code text on a code tile', '--color-code-text', '--color-code-bg', 'normal'],
    ['a keyword on a code tile', '--color-code-keyword', '--color-code-bg', 'normal'],
    ['a string on a code tile', '--color-code-string', '--color-code-bg', 'normal'],
    ['a comment on a code tile', '--color-code-comment', '--color-code-bg', 'normal'],

    ['the loading cover label', '--color-brand-dark', '--color-bg', 'normal'],

    ['error text on the page', '--color-error', '--color-bg', 'normal'],
    ['error text on a card', '--color-error', '--color-surface', 'normal'],
    ['danger button text', '--color-on-brand', '--color-error', 'normal'],
    ['the failed banner', '--color-on-brand', '--color-error', 'normal'],
    ['the stored banner', '--color-on-brand', '--color-ok', 'normal'],

    ['a control border, page', '--color-line-strong', '--color-bg', 'ui'],
    ['a control border, card', '--color-line-strong', '--color-surface', 'ui'],
    ['the wall slider thumb', '--color-accent', '--color-surface', 'ui'],
    ['a divider, decoration only', '--color-line', '--color-bg', 'decor'],
    ['a focus ring on a card', '--color-mark-line', '--color-surface', 'ui'],
    ['a focus ring on the page', '--color-mark-line', '--color-bg', 'ui'],
    ['a hover edge on a card', '--color-mark-line', '--color-surface', 'ui'],
    ['the section rule, page', '--color-mark-line', '--color-bg', 'ui'],
    ['a chip border on the page', '--color-mark-line', '--color-bg', 'ui'],

    ['a medium pill, hovered', '--color-ink', '--pill-medium-line', 'normal'],
    ['a tag pill, hovered', '--color-ink', '--pill-tag-line', 'normal'],
];

// A divider carries no meaning on its own, so WCAG sets no floor for it.
const FLOOR = { normal: 4.5, large: 3, ui: 3, decor: 0 };

let failed = 0;
for (const [label, fg, bg, kind] of PAIRS) {
    const value = ratio(fg, bg);
    const need = FLOOR[kind];
    const pass = value >= need;
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(30)} ${value.toFixed(2)} to 1` +
            `  (${kind} needs ${need})`
    );
}

console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
