// Small copies: the key naming, the reader fallback, and the endpoint.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const worker = (await import(`${ROOT}/src/index.js`)).default;
const { readImages, previewKey } = await import(`${ROOT}/public/js/row.js`);
const { thumbKey, THUMB_WIDTH } = await import(`${ROOT}/public/js/thumbnail.js`);

const results = [];
const check = (label, got, want) => results.push([label, JSON.stringify(got), JSON.stringify(want)]);

// The naming rule.
check('a copy keeps the whole key', thumbKey('piece.png'), 'thumbs/piece.png.webp');
check('a numbered picture too', thumbKey('piece-2.jpg'), 'thumbs/piece-2.jpg.webp');
check('the width is 938', THUMB_WIDTH, 938);

// What a wall should load.
const withCopy = readImages({ images: [{ key: 'a.png', thumb: 'thumbs/a.png.webp' }] })[0];
const without = readImages({ images: [{ key: 'b.png' }] })[0];
const promoted = readImages({ filename: 'old.jpg', width: 1600, height: 1200 })[0];

check('a copy is preferred', previewKey(withCopy), 'thumbs/a.png.webp');
check('no copy falls back', previewKey(without), 'b.png');
check('an old row falls back', previewKey(promoted), 'old.jpg');
check('an old row reports no copy', promoted.thumb, null);

// The endpoint.
const kv = new Map();
const r2 = new Map();

const env = {
  ACCESS_LOCAL_BYPASS: 'true',
  IMAGE_METADATA: {
    async get(k) { return kv.get(k) ?? null; },
    async put(k, v) { kv.set(k, v); },
    async list() { return { keys: [...kv.keys()].map(name => ({ name })), list_complete: true }; }
  },
  IMAGES: {
    async put(k, v) { r2.set(k, v); },
    async get(k) { return r2.has(k) ? {} : null; },
    async head(k) { return r2.has(k) ? {} : null; },
    async delete(k) { r2.delete(k); }
  },
  ASSETS: { async fetch() { return new Response('asset'); } }
};

kv.set('piece', JSON.stringify({
  kind: 'image', name: 'A piece',
  images: [{ key: 'piece.png', width: 3000, height: 2000 }]
}));
r2.set('piece.png', 'bytes');

async function post(fields) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);

  const res = await worker.fetch(
    new Request('http://localhost/api/thumbnail', { method: 'POST', body }),
    env, { waitUntil() {} });
  return { status: res.status, json: await res.json() };
}

const copy = new Blob([new Uint8Array(64)], { type: 'image/webp' });

const saved = await post({ id: 'piece', key: 'piece.png', thumb: copy });
check('a copy is stored', saved.status, 200);
check('it names the object', saved.json.thumb, 'thumbs/piece.png.webp');
check('the object exists', r2.has('thumbs/piece.png.webp'), true);
check('the row points at it',
  JSON.parse(kv.get('piece')).images[0].thumb, 'thumbs/piece.png.webp');
check('the original is untouched',
  JSON.parse(kv.get('piece')).images[0].key, 'piece.png');

// Guards.
check('an unknown row is 404', (await post({ id: 'nope', key: 'piece.png', thumb: copy })).status, 404);
check('a key from another row fails',
  (await post({ id: 'piece', key: 'somewhere-else.png', thumb: copy })).status, 400);
check('an empty copy fails',
  (await post({ id: 'piece', key: 'piece.png', thumb: new Blob([]) })).status, 400);
check('a missing id fails', (await post({ key: 'piece.png', thumb: copy })).status, 400);

const wrongMethod = await worker.fetch(
  new Request('http://localhost/api/thumbnail'), env, { waitUntil() {} });
check('GET is rejected', wrongMethod.status, 405);

// The gate covers it.
const stranger = await worker.fetch(
  new Request('https://portfolio.example/api/thumbnail', { method: 'POST' }),
  { ...env, ACCESS_LOCAL_BYPASS: undefined }, { waitUntil() {} });
check('the endpoint is gated', stranger.status, 503);

const page = await worker.fetch(
  new Request('https://portfolio.example/thumbnails'),
  { ...env, ACCESS_LOCAL_BYPASS: undefined }, { waitUntil() {} });
check('the page is gated', page.status, 503);

let failed = 0;
for (const [label, got, want] of results) {
  const pass = got === want;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(32)} ${got}${pass ? '' : `  want ${want}`}`);
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
