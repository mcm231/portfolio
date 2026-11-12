// The filters the gallery search reads out of the address bar.
//
// A pill in a detail view writes those urls, so this file checks the reading
// half of that contract. test/term-pill.test.mjs checks the writing half.
//
// The page loads React from the markup, so the module expects the global.
// Nothing here renders, so a stub is enough to import the file.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

globalThis.React = { createElement: () => null };

const { filtersFromQuery } = await import(`${ROOT}/public/js/components/gallery-page.js`);
const { termUrl } = await import(`${ROOT}/public/js/components/term-pill.js`);

const results = [];
const check = (label, got, want) =>
    results.push([label, JSON.stringify(got), JSON.stringify(want)]);

const names = filters => filters.map(f => `${f.type}:${f.value}`);

check('no query asks for nothing', filtersFromQuery(''), []);
check('a missing query asks for nothing', filtersFromQuery(undefined), []);

check('a medium arrives', names(filtersFromQuery('?medium=watercolor')), ['medium:watercolor']);
check('a tag arrives', names(filtersFromQuery('?tag=landscape')), ['tag:landscape']);

// A filter chip shows the label of its type, so the label must come along.
check('a filter carries its label', filtersFromQuery('?medium=ink')[0].label, 'Medium');

// A pill writes the url, and this page reads it. The two must agree.
check(
    'a pill url lands as its own filter',
    names(filtersFromQuery(termUrl('tag', 'pen & ink').split('?')[1])),
    ['tag:pen & ink']
);

// Two keys together, and the same key twice.
check('two kinds arrive together', names(filtersFromQuery('?medium=ink&tag=landscape')), [
    'medium:ink',
    'tag:landscape',
]);
check('one key may repeat', names(filtersFromQuery('?tag=a&tag=b')), ['tag:a', 'tag:b']);
check('a repeat of one value lands once', names(filtersFromQuery('?tag=a&tag=a')), ['tag:a']);

// Junk must never become a filter that matches nothing.
check('an empty value is dropped', filtersFromQuery('?tag='), []);
check('a space only value is dropped', filtersFromQuery('?tag=%20%20'), []);
check('an unknown key is dropped', filtersFromQuery('?colour=red'), []);
check('a trimmed value lands clean', names(filtersFromQuery('?tag=%20ink%20')), ['tag:ink']);

// The other two filter types ride the same road.
check('a title arrives', names(filtersFromQuery('?title=Blue')), ['title:Blue']);
check('a date arrives', names(filtersFromQuery('?dateCreated=2026-04-02')), [
    'dateCreated:2026-04-02',
]);

let failed = 0;
for (const [label, got, want] of results) {
    const pass = got === want;
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(36)} ${got}${pass ? '' : `  want ${want}`}`
    );
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
