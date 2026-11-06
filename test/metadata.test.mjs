// The read path of /api/image-metadata, and what the size backfill writes
// back. The backfill must never turn a stored field into a guessed one.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { onRequest } = await import(`${ROOT}/src/api/image-metadata.js`);

const results = [];
const check = (label, got, want) => results.push([label, JSON.stringify(got), JSON.stringify(want)]);

// 8 byte signature, then an IHDR chunk that says 4 by 3 pixels.
const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  0, 0, 0, 4, 0, 0, 0, 3,
  8, 2, 0, 0, 0, 0, 0, 0
]);

// A code project that carries a picture, and no stored size. Reading it runs
// the backfill, which is where the kind used to disappear.
const CODE_ROW = {
  kind: 'code',
  name: 'Portfolio site',
  tags: ['javascript'],
  mediums: [],
  language: 'javascript',
  snippet: 'const a = 1;',
  images: [{ key: 'portfolio.png' }]
};

// A row written before the lists: one medium string, one filename, no kind.
const OLD_ROW = {
  name: 'Piece One',
  filename: 'piece-one.jpg',
  medium: 'Ink',
  tags: ['watercolor']
};

function stubEnv(rows) {
  const kv = new Map(Object.entries(rows).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    kv,
    IMAGE_METADATA: {
      async get(k) { return kv.get(k) ?? null; },
      async put(k, v) { kv.set(k, v); },
      async list() { return { keys: [...kv.keys()].map(name => ({ name })), list_complete: true }; }
    },
    IMAGES: {
      async head() { return {}; },
      async get() { return { async arrayBuffer() { return PNG_HEADER.buffer; } }; }
    }
  };
}

async function read(env, path) {
  const res = await onRequest({ request: new Request(`https://portfolio.example${path}`), env });
  return { status: res.status, body: await res.json() };
}

// One row, by id.
let env = stubEnv({ 'portfolio-site': CODE_ROW });
let got = await read(env, '/api/image-metadata?id=portfolio-site');
let saved = JSON.parse(env.kv.get('portfolio-site'));

check('the reader sees the code kind', got.body.kind, 'code');
check('the size is filled in', [got.body.images[0].width, got.body.images[0].height], [4, 3]);
check('the stored row keeps the code kind', saved.kind, 'code');
check('the stored row keeps the size', saved.images[0].width, 4);
check('the stored row is stamped', saved.sizeVersion, 2);
check('the stored row keeps the snippet', saved.snippet, 'const a = 1;');
check('the stored row holds no id', saved.id, undefined);

// Reading it again must not change the kind a second time.
got = await read(env, '/api/image-metadata?id=portfolio-site');
check('a second read keeps the code kind', got.body.kind, 'code');

// Every row, through the list path.
env = stubEnv({ 'portfolio-site': CODE_ROW });
got = await read(env, '/api/image-metadata');
saved = JSON.parse(env.kv.get('portfolio-site'));

check('the list reports the code kind', got.body[0].kind, 'code');
check('the list write keeps the code kind', saved.kind, 'code');

// An old row: the lists are promoted, and no kind is invented.
env = stubEnv({ 'piece-one': OLD_ROW });
got = await read(env, '/api/image-metadata?id=piece-one');
saved = JSON.parse(env.kv.get('piece-one'));

check('an old row reads as an image', got.body.kind, 'image');
check('the medium is promoted', got.body.mediums, ['ink']);
check('the filename is promoted', got.body.images[0].key, 'piece-one.jpg');
check('the stored row drops the medium', saved.medium, undefined);
check('the stored row drops the filename', saved.filename, undefined);
check('the stored row holds the list', saved.mediums, ['ink']);
check('the stored row invents no kind', saved.kind, undefined);

let failed = 0;
for (const [label, got, want] of results) {
  const pass = got === want;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(38)} ${got}${pass ? '' : `  want ${want}`}`);
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
