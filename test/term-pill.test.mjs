// The term pill, under a DOM stub. No browser, no network.
//
// A pill writes the url that the gallery search reads back, so the key it
// uses is the contract. test/gallery-page.test.mjs checks the other half.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

globalThis.document = {
    createElement: tag => ({
        tag,
        className: '',
        textContent: '',
        href: '',
        attrs: {},
        setAttribute(name, value) {
            this.attrs[name] = value;
        },
    }),
};

const { buildTermPill, termUrl } = await import(`${ROOT}/public/js/components/term-pill.js`);

const results = [];
const check = (label, got, want) =>
    results.push([label, JSON.stringify(got), JSON.stringify(want)]);

// The key is the filter type name of the gallery search.
check(
    'a medium asks for a medium',
    termUrl('medium', 'watercolor'),
    '/pages/gallery?medium=watercolor'
);
check('a tag asks for a tag', termUrl('tag', 'landscape'), '/pages/gallery?tag=landscape');

// A term is free text, so a space or an ampersand must survive the trip.
check('a space travels', termUrl('medium', 'oil paint'), '/pages/gallery?medium=oil%20paint');
check('an ampersand travels', termUrl('tag', 'pen & ink'), '/pages/gallery?tag=pen%20%26%20ink');

const medium = buildTermPill('medium', 'watercolor');
check('a pill is a link', medium.tag, 'a');
check('a pill carries the term', medium.textContent, 'watercolor');
check('a pill names its kind', medium.className, 'pill pill-medium');
check('a pill points at the gallery', medium.href, '/pages/gallery?medium=watercolor');
check('a pill says what it does', medium.attrs['aria-label'].includes('watercolor'), true);

const tag = buildTermPill('tag', 'landscape');
check('a tag takes its own color', tag.className, 'pill pill-tag');
check('a tag points at the gallery', tag.href, '/pages/gallery?tag=landscape');

let failed = 0;
for (const [label, got, want] of results) {
    const pass = got === want;
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} ${got}${pass ? '' : `  want ${want}`}`
    );
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
