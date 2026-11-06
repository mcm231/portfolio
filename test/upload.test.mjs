// The upload endpoint, end to end, against stub KV and R2. No network, no
// Cloudflare login, and nothing written to the real database.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const worker = (await import(`${ROOT}/src/index.js`)).default;

const kv = new Map();
const r2 = new Map();

const env = {
  ACCESS_LOCAL_BYPASS: 'true',           // host below is localhost
  IMAGE_METADATA: {
    async get(k) { return kv.get(k) ?? null; },
    async put(k, v) { kv.set(k, v); },
    async delete(k) { kv.delete(k); },
    async list() { return { keys: [...kv.keys()].map(name => ({ name })), list_complete: true }; }
  },
  IMAGES: {
    async head(k) { return r2.has(k) ? {} : null; },
    async put(k, v) { r2.set(k, v); },
    async delete(k) { r2.delete(k); }
  },
  ASSETS: { async fetch() { return new Response('asset'); } }
};

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

async function upload(fields = {}) {
  const body = new FormData();
  if (!fields.noFile) {
    const names = fields.fileNames ?? [fields.fileName ?? 'shot.png'];
    for (const fileName of names) {
      body.append('file', new File([PNG], fileName, { type: 'image/png' }));
    }
  }
  const defaults = { name: 'Piece', dateCreated: '2026-01-01' };
  for (const [k, v] of Object.entries({ ...defaults, ...fields })) {
    if (['fileName', 'fileNames', 'tags', 'mediums', 'noFile'].includes(k)) continue;
    if (v !== undefined) body.set(k, String(v));
  }
  for (const tag of fields.tags ?? ['watercolor']) body.append('tags', tag);
  for (const medium of fields.mediums ?? ['ink']) body.append('mediums', medium);

  const res = await worker.fetch(
    new Request('http://localhost/api/upload', { method: 'POST', body }),
    env, { waitUntil() {} }
  );
  return { status: res.status, json: await res.json() };
}

const results = [];
const check = (label, got, want) => results.push([label, JSON.stringify(got), JSON.stringify(want)]);

const first = await upload();
check('first upload keeps the id', first.json.id, 'piece');
check('first upload is 201', first.status, 201);
check('the cover follows the id', first.json.entry.images[0].key, 'piece.png');

const second = await upload();
check('a clash adds 2', second.json.id, 'piece-2');
check('it reports the old id', second.json.renamedFrom, 'piece');

const third = await upload();
check('the next clash adds 3', third.json.id, 'piece-3');
check('the cover follows again', third.json.entry.images[0].key, 'piece-3.png');

const typed = await upload({ id: 'piece-2' });
check('a typed clash climbs', typed.json.id, 'piece-4');

const replaced = await upload({ overwrite: 'true', description: 'new text' });
check('overwrite keeps the id', replaced.json.id, 'piece');
check('overwrite returns 200', replaced.status, 200);
check('overwrite says replaced', replaced.json.replaced, true);
check('overwrite wrote the entry', JSON.parse(kv.get('piece')).description, 'new text');

const fresh = await upload({ name: 'Other Work', id: '' });
check('a new name is untouched', fresh.json.id, 'other-work');

check('five ids exist', [...kv.keys()].sort(), ['other-work', 'piece', 'piece-2', 'piece-3', 'piece-4']);
check('r2 holds one object each', r2.size, kv.size);

// The name is optional. The id then comes from the file name.
const noName = await upload({ name: '', fileName: 'quiet-study.png' });
check('an upload needs no name', noName.status, 201);
check('the id comes from the file', noName.json.id, 'quiet-study');
check('the stored name is empty', JSON.parse(kv.get('quiet-study')).name, '');

const noNameNoFile = await upload({ name: '', noFile: true, id: '', overwrite: 'true' });
check('nothing to build an id fails', noNameNoFile.json.error,
  'Type an id. Nothing else gives one.');

const beforeReject = r2.size;
const missingTag = await upload({ tags: [] });
check('no tag is rejected', missingTag.json.error, 'Pick at least one tag.');
check('a rejected upload adds nothing', r2.size, beforeReject);

const missingMedium = await upload({ mediums: [] });
check('no medium is rejected', missingMedium.json.error, 'Name at least one medium.');


// Any term is allowed. It is cleaned, not checked against a list.
const freeTerms = await upload({
  id: 'free-terms', name: 'Free Terms',
  tags: ['Brand New Tag', 'brand new tag', '  SECOND  '],
  mediums: ['Oil Paint', 'oil_paint']
});
check('a new tag is kept', JSON.parse(kv.get('free-terms')).tags,
  ['brand-new-tag', 'second']);
check('a new medium is kept', JSON.parse(kv.get('free-terms')).mediums, ['oil-paint']);

// ---------- Edit mode: a save with no new file ----------

const before = JSON.parse(kv.get('piece'));
const beforeEdit = r2.size;
const edited = await upload({
  noFile: true, id: 'piece', overwrite: 'true',
  name: 'Renamed Piece', mediums: ['Charcoal'], tags: ['charcoal']
});
const after = JSON.parse(kv.get('piece'));

check('a fileless edit works', edited.status, 200);
check('the edit keeps the id', edited.json.id, 'piece');
check('the edit keeps the pictures', after.images, before.images);
check('the edit saves the name', after.name, 'Renamed Piece');
check('the edit saves the tags', after.tags, ['charcoal']);
check('the edit saves the mediums', after.mediums, ['charcoal']);
check('the edit adds no object', r2.size, beforeEdit);

const orphan = await upload({ noFile: true, id: 'nothing-here', overwrite: 'true' });
check('no file and no row fails', orphan.json.error, 'Choose an image file.');

const noFileNoOverwrite = await upload({ noFile: true, id: 'piece' });
check('no file needs overwrite', noFileNoOverwrite.json.error, 'Choose an image file.');

// ---------- Several pictures on one row ----------

const many = await upload({
  id: 'three-shots', name: 'Three shots',
  fileNames: ['one.png', 'two.png', 'three.png']
});
const manyRow = JSON.parse(kv.get('three-shots'));

check('all three are stored', manyRow.images.length, 3);
check('the cover takes the plain id', manyRow.images[0].key, 'three-shots.png');
check('the rest are numbered',
  manyRow.images.slice(1).map(i => i.key), ['three-shots-2.png', 'three-shots-3.png']);
check('all three objects exist',
  manyRow.images.every(i => r2.has(i.key)), true);

// An edit with no new file keeps every picture.
const keptAll = await upload({
  noFile: true, id: 'three-shots', overwrite: 'true', name: 'Three shots, renamed'
});
check('an edit keeps all three', JSON.parse(kv.get('three-shots')).images.length, 3);
check('an edit adds no object', keptAll.status, 200);

// A new set replaces the old one.
await upload({ id: 'three-shots', overwrite: 'true', fileNames: ['only.png'] });
check('a new set replaces the old', JSON.parse(kv.get('three-shots')).images.length, 1);

// A delete takes every picture.
const beforeDelete = r2.size;
await worker.fetch(new Request('http://localhost/api/upload?id=three-shots',
  { method: 'DELETE' }), env, { waitUntil() {} });
check('a delete clears the row', kv.has('three-shots'), false);
check('a delete clears its object', r2.size, beforeDelete - 1);

// ---------- A code project ----------

const project = await upload({
  noFile: true, kind: 'code', id: 'portfolio-site', name: 'Portfolio site',
  tags: ['javascript'], mediums: ['web'],
  repoUrl: 'https://github.com/maya/portfolio',
  liveUrl: 'https://portfolio.example',
  language: 'JavaScript',
  snippet: 'export const hello = () => "hi";'
});
const codeRow = JSON.parse(kv.get('portfolio-site'));

check('a code row needs no picture', project.status, 201);
check('the kind is stored', codeRow.kind, 'code');
check('it keeps the repo link', codeRow.repoUrl, 'https://github.com/maya/portfolio');
// A bare origin gains a trailing slash, which is the normal form of a url.
check('it keeps the live link', codeRow.liveUrl, 'https://portfolio.example/');
check('the language is cleaned', codeRow.language, 'javascript');
check('it keeps the snippet', codeRow.snippet, 'export const hello = () => "hi";');

// The stored snippet keeps every indent, so the shape of the code survives.
const indented = await upload({
  noFile: true, kind: 'code', id: 'indented', name: 'Indented',
  snippet: '\n    def go():\n        return 1   \n\n'
});
check('the stored indent survives', indented.status, 201);
check('the first line keeps its spaces',
  JSON.parse(kv.get('indented')).snippet, '    def go():\n        return 1');
check('a code row has no picture', codeRow.images, []);
check('a code row has no medium', codeRow.mediums, []);

// A medium sent with a code row is dropped, not stored.
const sentMedium = await upload({
  noFile: true, kind: 'code', id: 'ignores-medium', name: 'Ignores medium',
  mediums: ['web', 'tooling']
});
check('a code row needs no medium', sentMedium.status, 201);
check('a sent medium is dropped', JSON.parse(kv.get('ignores-medium')).mediums, []);

// An image row still needs one.
const noMediumImage = await upload({ id: 'needs-medium', name: 'Needs medium', mediums: [] });
check('an image row still needs one', noMediumImage.json.error, 'Name at least one medium.');

// A link that is not http or https is refused.
const unsafe = await upload({
  noFile: true, kind: 'code', id: 'unsafe-link', name: 'Unsafe',
  repoUrl: 'javascript:alert(1)'
});
check('a javascript url is dropped', JSON.parse(kv.get('unsafe-link')).repoUrl, '');

// An image row still needs a picture.
const noPicture = await upload({ noFile: true, kind: 'image', id: 'needs-art', name: 'Needs art' });
check('an image row still needs art', noPicture.json.error, 'Choose an image file.');

// A code project with a screenshot keeps it.
const withShot = await upload({
  kind: 'code', id: 'with-shot', name: 'With a shot', fileName: 'shot.png'
});
check('a code row may carry a picture',
  JSON.parse(kv.get('with-shot')).images[0].key, 'with-shot.png');

// A kind the form never sends falls back to image.
const odd = await upload({ kind: 'nonsense', id: 'odd-kind', name: 'Odd' });
check('an unknown kind becomes image', JSON.parse(kv.get('odd-kind')).kind, 'image');

// ---------- Delete ----------

async function remove(id) {
  const res = await worker.fetch(
    new Request(`http://localhost/api/upload?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
    env, { waitUntil() {} }
  );
  return { status: res.status, json: await res.json() };
}

const gone = await remove('piece');
check('delete returns 200', gone.status, 200);
check('delete reports the id', gone.json.id, 'piece');
check('delete clears the row', kv.has('piece'), false);
check('delete clears the object', r2.has(before.images[0].key), false);

const missing = await remove('never-existed');
check('delete of nothing is 404', missing.status, 404);

const noId = await remove('');
check('delete needs an id', noId.status, 400);

const methodCheck = await worker.fetch(
  new Request('http://localhost/api/upload', { method: 'PUT' }), env, { waitUntil() {} });
check('PUT is rejected', methodCheck.status, 405);

let failed = 0;
for (const [label, got, want] of results) {
  const pass = got === want;
  if (!pass) failed++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(30)} ${got}${pass ? '' : `  want ${want}`}`);
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
