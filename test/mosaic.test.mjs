// The photo wall layout, under a DOM stub. No browser, no network.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function stubDom() {
    const make = () => {
        const node = {
            className: '',
            children: [],
            style: {
                _v: {},
                cssText: '',
                setProperty(k, v) {
                    this._v[k] = v;
                },
            },
            appendChild(c) {
                this.children.push(c);
            },
            attrs: {},
            setAttribute(k, v) {
                this.attrs[k] = v;
            },
            listeners: {},
            addEventListener(name, fn) {
                (this.listeners[name] ||= []).push(fn);
            },
            classList: {
                add(name) {
                    node.className += ` ${name}`;
                },
            },
        };
        return node;
    };

    globalThis.document = {
        createElement: make,
        createDocumentFragment: () => ({
            children: [],
            appendChild(c) {
                this.children.push(c);
            },
        }),
    };
    globalThis.window = { innerWidth: 1512, innerHeight: 864 };
}
stubDom();

const { renderMosaic } = await import(`${ROOT}/public/js/components/mosaic.js`);

const CELL = 118,
    GAP = 3;
const card = {
    getBoundingClientRect: () => ({ width: 630, height: 300 }),
    style: { setProperty() {} },
};

// Runs the real render against a database of `count` rows. `sizes` gives the
// pixel size of each row, cycled.
async function wall(count, sizes = [{ width: 1600, height: 1200 }], onSelect = null) {
    // public/js/api.js reads the body as text, then parses it.
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () =>
            JSON.stringify(
                Array.from({ length: count }, (_, i) => ({
                    id: `piece-${i}`,
                    name: `Piece ${i}`,
                    images: [{ key: `piece-${i}.jpg`, ...sizes[i % sizes.length] }],
                }))
            ),
    });

    let fragment;
    const result = await renderMosaic({
        container: {
            replaceChildren(f) {
                fragment = f;
            },
        },
        card,
        onSelect,
    });

    const rects = fragment.children.map(n => {
        const g = Object.fromEntries(n.style.cssText.split(';').map(p => p.split(':')));
        return {
            x: parseFloat(g['--x']),
            y: parseFloat(g['--y']),
            w: parseFloat(g['--w']),
            h: parseFloat(g['--h']),
            cols: (parseFloat(g['--w']) + GAP) / CELL,
            rows: (parseFloat(g['--h']) + GAP) / CELL,
            hasImage: n.children.length > 0,
        };
    });
    return { result, rects, fragment };
}

const results = [];
const check = (label, got, want) =>
    results.push([label, JSON.stringify(got), JSON.stringify(want)]);

for (const count of [1, 2, 7, 40]) {
    const { result, rects } = await wall(count);
    check(`${count} rows give ${count} tiles`, result.tiles, count);
    check(
        `${count} rows all carry an image`,
        rects.every(r => r.hasImage),
        true
    );
}

// Orientation. A photo must never land in a tile of the other shape.
const LANDSCAPE = { width: 1600, height: 1200 };
const PORTRAIT = { width: 1200, height: 1600 };
const SQUARE = { width: 1000, height: 1000 };
const WIDE = { width: 3000, height: 1000 };
const TALL = { width: 1000, height: 3000 };

const land = await wall(24, [LANDSCAPE, WIDE]);
check(
    'landscape never goes tall',
    land.rects.every(r => r.cols > r.rows),
    true
);

const port = await wall(24, [PORTRAIT, TALL]);
check(
    'portrait never goes wide',
    port.rects.every(r => r.cols < r.rows),
    true
);

const sq = await wall(18, [SQUARE]);
check(
    'a square stays square',
    sq.rects.every(r => r.cols === r.rows),
    true
);

const mixed = await wall(36, [LANDSCAPE, PORTRAIT, SQUARE]);
const wrong = mixed.rects.filter((r, i) => {
    const kind = [LANDSCAPE, PORTRAIT, SQUARE][i % 3];
    if (kind.width > kind.height) return !(r.cols > r.rows);
    if (kind.width < kind.height) return !(r.cols < r.rows);
    return r.cols !== r.rows;
});
check('a mixed wall keeps every shape', wrong.length, 0);

// A code row with no picture draws code, in a square of at least two cells.
const codeWall = await mixedWall(
    Array.from({ length: 12 }, (_, i) => ({
        id: `code-${i}`,
        kind: 'code',
        name: `Project ${i}`,
        language: 'python',
    }))
);
check('every code row draws a tile', codeWall.result.tiles, 12);
check('it counts them as code', codeWall.result.code, 12);
check('none counts as a panel', codeWall.result.panels, 0);

const codeRects = codeWall.nodes;
check(
    'every code tile is marked',
    codeRects.every(n => n.isCode),
    true
);
check(
    'no code tile is one cell',
    codeRects.every(n => n.cols >= 2),
    true
);

// The loading cover waits for the first screen only, so the wall reports the
// pictures that screen shows and no others.
const near = await wall(60);
check('the first screen names pictures', near.result.covers.length > 0, true);
check(
    'it names no more than the wall holds',
    near.result.covers.length <= near.result.images,
    true
);
check('it names fewer than the whole wall', near.result.covers.length < 60, true);

const noSize = await wall(12, [{}]);
check(
    'an unknown size goes square',
    noSize.rects.every(r => r.cols === r.rows),
    true
);

const { rects } = await wall(40, [LANDSCAPE, PORTRAIT, SQUARE, WIDE, TALL]);

let overlaps = 0;
for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i],
            b = rects[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps++;
    }
check('no tile overlaps another', overlaps, 0);

const onGrid = rects.every(
    r =>
        Number.isInteger(Math.round(r.cols * 1e6) / 1e6) &&
        Number.isInteger(Math.round(r.rows * 1e6) / 1e6)
);
check('every span is whole cells', onGrid, true);

const gutters = new Set(rects.map(r => Math.round((r.cols * CELL - r.w) * 100) / 100));
check('one gutter width only', [...gutters], [GAP]);

const shapes = new Set(rects.map(r => `${r.cols}x${r.rows}`));
check('at least six shapes appear', shapes.size >= 6, true);

const areas = rects.map(r => r.cols * r.rows);
check('the largest tile is 9 cells or more', Math.max(...areas) >= 9, true);
check(
    'no tile is more than 4 cells long',
    Math.max(...rects.map(r => Math.max(r.cols, r.rows))),
    4
);

// A band longer than two to one reads as a strip, not a picture.
const widest = Math.max(...rects.map(r => Math.max(r.cols / r.rows, r.rows / r.cols)));
check('no tile goes past two to one', widest, 2);
check('the smallest tile is one cell', Math.min(...areas), 1);

// A panel is a row with no filename. It draws a color block, and it sits in
// the wall beside the photos.
async function mixedWall(rows) {
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(rows),
    });
    let fragment;
    const result = await renderMosaic({
        container: {
            replaceChildren(f) {
                fragment = f;
            },
        },
        card,
    });
    const nodes = fragment.children.map(n => ({
        isPanel: n.className.includes('is-panel'),
        isCode: n.className.includes('is-code'),
        cols:
            (parseFloat(
                n.style.cssText
                    .split(';')
                    .map(p => p.split(':'))
                    .find(p => p[0] === '--w')[1]
            ) +
                3) /
            118,
        hasImage: n.children.length > 0,
        color: n.style._v['--panel'],
        label: n.attrs && n.attrs['aria-label'],
    }));
    return { result, nodes };
}

const PHOTO = { id: 'a', name: 'A photo', images: [{ key: 'a.jpg', width: 1600, height: 1200 }] };
const STORY = { id: 'b', name: 'A story' };

const mix = await mixedWall([PHOTO, STORY, { ...PHOTO, id: 'c' }, { ...STORY, id: 'd' }]);
check('a mixed wall seats every row', mix.result.tiles, 4);
check('it counts the photos', mix.result.images, 2);
check('it counts the panels', mix.result.panels, 2);
check('two tiles hold an image', mix.nodes.filter(n => n.hasImage).length, 2);
check('two tiles are panels', mix.nodes.filter(n => n.isPanel).length, 2);
check(
    'every panel takes a color',
    mix.nodes.filter(n => n.isPanel).every(n => n.color),
    true
);

// A row may ask for its own shape and its own color.
const asked = await mixedWall([
    { id: 'p1', name: 'Tall', shape: 'portrait', panelColor: 3 },
    { id: 'p2', name: 'Wide', shape: 'landscape', panelColor: 7 },
]);
check(
    'a panel keeps its color',
    asked.nodes.map(n => n.color),
    ['var(--blank-3)', 'var(--blank-7)']
);

const asPanels = await wall(0);
check('an empty database shows nothing', asPanels.result.tiles, 0);

// A dead API cannot know the row count, so it falls back to panels.
globalThis.fetch = async () => {
    throw new Error('offline');
};
let offlineFragment;
const offline = await renderMosaic({
    container: {
        replaceChildren(f) {
            offlineFragment = f;
        },
    },
    card,
    onSelect: () => {
        throw new Error('A placeholder must open nothing.');
    },
});
check('an offline wall still fills', offline.tiles > 40, true);
check('an offline wall has no images', offline.images, 0);
check('an offline wall is all panels', offline.panels, offline.tiles);
check('an offline wall names no picture', offline.covers.length, 0);
check(
    'an offline tile answers no click',
    offlineFragment.children.every(tile => !tile.listeners.click),
    true
);

// A click on a tile opens that row. js/home.js passes openDetail here.
const picked = [];
const clickable = await wall(6, undefined, entry => picked.push(entry.id));
clickable.fragment.children.forEach(tile =>
    (tile.listeners.click || []).forEach(listener => listener())
);
check('every tile answers a click', picked.length, 6);
check('a tile hands over its own row', picked[0], 'piece-0');

// A wall with no handler stays a picture.
const quiet = await wall(3);
check(
    'no handler leaves no listener',
    quiet.fragment.children.every(tile => !tile.listeners.click),
    true
);

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
