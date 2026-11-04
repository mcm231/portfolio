// The photo wall layout, under a DOM stub. No browser, no network.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function stubDom() {
  globalThis.document = {
    createElement: () => ({
      className: '', children: [],
      style: { _v: {}, cssText: '', setProperty(k, v) { this._v[k] = v; } },
      appendChild(c) { this.children.push(c); },
      classList: { add() {} }
    }),
    createDocumentFragment: () => ({ children: [], appendChild(c) { this.children.push(c); } })
  };
  globalThis.window = { innerWidth: 1512, innerHeight: 864 };
}
stubDom();

const { renderMosaic } = await import(`${ROOT}/public/js/mosaic.js`);

const CELL = 118, GAP = 3;
const card = { getBoundingClientRect: () => ({ width: 630, height: 300 }), style: { setProperty() {} } };

// Runs the real render against a database of `count` rows. `sizes` gives the
// pixel size of each row, cycled.
async function wall(count, sizes = [{ width: 1600, height: 1200 }]) {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => Array.from({ length: count }, (_, i) => ({
      id: `piece-${i}`, filename: `piece-${i}.jpg`, name: `Piece ${i}`,
      ...sizes[i % sizes.length]
    }))
  });

  let fragment;
  const result = await renderMosaic({
    container: { replaceChildren(f) { fragment = f; } }, card
  });

  const rects = fragment.children.map(n => {
    const g = Object.fromEntries(n.style.cssText.split(';').map(p => p.split(':')));
    return {
      x: parseFloat(g['--x']), y: parseFloat(g['--y']),
      w: parseFloat(g['--w']), h: parseFloat(g['--h']),
      cols: (parseFloat(g['--w']) + GAP) / CELL,
      rows: (parseFloat(g['--h']) + GAP) / CELL,
      hasImage: n.children.length > 0
    };
  });
  return { result, rects };
}

const results = [];
const check = (label, got, want) => results.push([label, JSON.stringify(got), JSON.stringify(want)]);

for (const count of [1, 2, 7, 40]) {
  const { result, rects } = await wall(count);
  check(`${count} rows give ${count} tiles`, result.tiles, count);
  check(`${count} rows all carry an image`, rects.every(r => r.hasImage), true);
}

// Orientation. A photo must never land in a tile of the other shape.
const LANDSCAPE = { width: 1600, height: 1200 };
const PORTRAIT = { width: 1200, height: 1600 };
const SQUARE = { width: 1000, height: 1000 };
const WIDE = { width: 3000, height: 1000 };
const TALL = { width: 1000, height: 3000 };

const land = await wall(24, [LANDSCAPE, WIDE]);
check('landscape never goes tall', land.rects.every(r => r.cols > r.rows), true);

const port = await wall(24, [PORTRAIT, TALL]);
check('portrait never goes wide', port.rects.every(r => r.cols < r.rows), true);

const sq = await wall(18, [SQUARE]);
check('a square stays square', sq.rects.every(r => r.cols === r.rows), true);

const mixed = await wall(36, [LANDSCAPE, PORTRAIT, SQUARE]);
const wrong = mixed.rects.filter((r, i) => {
  const kind = [LANDSCAPE, PORTRAIT, SQUARE][i % 3];
  if (kind.width > kind.height) return !(r.cols > r.rows);
  if (kind.width < kind.height) return !(r.cols < r.rows);
  return r.cols !== r.rows;
});
check('a mixed wall keeps every shape', wrong.length, 0);

const noSize = await wall(12, [{}]);
check('an unknown size goes square', noSize.rects.every(r => r.cols === r.rows), true);

const { rects } = await wall(40, [LANDSCAPE, PORTRAIT, SQUARE, WIDE, TALL]);

let overlaps = 0;
for (let i = 0; i < rects.length; i++)
  for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps++;
  }
check('no tile overlaps another', overlaps, 0);

const onGrid = rects.every(r => Number.isInteger(Math.round(r.cols * 1e6) / 1e6)
                             && Number.isInteger(Math.round(r.rows * 1e6) / 1e6));
check('every span is whole cells', onGrid, true);

const gutters = new Set(rects.map(r => Math.round((r.cols * CELL - r.w) * 100) / 100));
check('one gutter width only', [...gutters], [GAP]);

const shapes = new Set(rects.map(r => `${r.cols}x${r.rows}`));
check('at least six shapes appear', shapes.size >= 6, true);

const areas = rects.map(r => r.cols * r.rows);
check('the largest tile is 9 cells or more', Math.max(...areas) >= 9, true);
check('no tile is more than 4 cells long', Math.max(...rects.map(r => Math.max(r.cols, r.rows))), 4);
check('the smallest tile is one cell', Math.min(...areas), 1);

// A dead API cannot know the row count, so it falls back to blanks.
globalThis.fetch = async () => { throw new Error('offline'); };
let offlineFragment;
const offline = await renderMosaic({
  container: { replaceChildren(f) { offlineFragment = f; } }, card
});
check('an offline wall still fills', offline.tiles > 40, true);
check('an offline wall has no images', offline.images, 0);

let failed = 0;
for (const [label, got, want] of results) {
  const pass = got === want;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} ${got}${pass ? '' : `  want ${want}`}`);
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
