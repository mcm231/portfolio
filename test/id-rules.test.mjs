// The id numbering rules, and the two walkers that use them.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { slugify, nextId, freeId, freeIdSync } = await import(
    `${ROOT}/public/js/shared/id-rules.js`
);

const cases = [];
const check = (label, got, want) => cases.push([label, JSON.stringify(got), JSON.stringify(want)]);

check('slugify trims and dashes', slugify('  My Piece!! '), 'my-piece');
check('slugify lowercases', slugify('WaterColor Study'), 'watercolor-study');
check('slugify drops edge dashes', slugify('--a--b--'), 'a-b');

check('plain id gets 2', nextId('piece'), 'piece-2');
check('2 becomes 3', nextId('piece-2'), 'piece-3');
check('9 becomes 10', nextId('piece-9'), 'piece-10');
check('only the last number moves', nextId('study-3-sketch-7'), 'study-3-sketch-8');

const taken = new Set(['piece', 'piece-2', 'piece-3', 'solo']);
check(
    'free id skips the run',
    freeIdSync('piece', id => taken.has(id)),
    'piece-4'
);
check(
    'a free id stays put',
    freeIdSync('open', id => taken.has(id)),
    'open'
);
check(
    'one clash adds 2',
    freeIdSync('solo', id => taken.has(id)),
    'solo-2'
);
check('async matches sync', await freeId('piece', async id => taken.has(id)), 'piece-4');

// A full run must throw rather than loop forever.
const everything = { has: () => true };
let threw = false;
try {
    freeIdSync('x', id => everything.has(id));
} catch {
    threw = true;
}
check('a full range throws', threw, true);

let failed = 0;
for (const [label, got, want] of cases) {
    const pass = got === want;
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(28)} ${got}${pass ? '' : `  want ${want}`}`
    );
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
