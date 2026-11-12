// Routes the real Worker with stub bindings. No network, no Cloudflare login.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const worker = (await import(`${ROOT}/src/index.js`)).default;

// An older row: one medium string, one filename. Both are promoted on read.
const kv = new Map([
    [
        'piece-one',
        JSON.stringify({
            name: 'Piece One',
            filename: 'piece-one.jpg',
            tags: ['watercolor'],
            medium: 'Ink',
            dateCreated: '2026-01-01',
        }),
    ],
]);

const env = {
    IMAGE_METADATA: {
        async get(k) {
            return kv.get(k) ?? null;
        },
        async list() {
            return { keys: [...kv.keys()].map(name => ({ name })), list_complete: true };
        },
        async put(k, v) {
            kv.set(k, v);
        },
    },
    IMAGES: {
        async head() {
            return {};
        },
        // The stub compares an etag the way R2 does. A match means the caller
        // holds the bytes, so the object comes back with no body.
        async get(key, options) {
            const object = {
                body: 'bytes',
                httpEtag: '"e"',
                writeHttpMetadata() {},
                // A one pixel PNG header, so the size backfill has something to read.
                async arrayBuffer() {
                    return PNG_HEADER.buffer;
                },
            };

            const held = options && options.onlyIf && options.onlyIf.etagDoesNotMatch;
            return held === 'e' ? { ...object, body: undefined } : object;
        },
        async put() {},
        async delete() {},
    },
    ASSETS: {
        async fetch(req) {
            return new Response(`asset:${new URL(req.url).pathname}`, { status: 200 });
        },
    },
};

// 8 byte signature, then an IHDR chunk that says 4 by 3 pixels.
const PNG_HEADER = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 4,
    0, 0, 0, 3, 8, 2, 0, 0, 0, 0, 0, 0,
]);

const ctx = { waitUntil() {} };
const HOST = 'https://portfolio.mayacollege2020.workers.dev';

async function hit(path, init) {
    const res = await worker.fetch(new Request(HOST + path, init), env, ctx);
    const text = await res.clone().text();
    return {
        status: res.status,
        body: text.slice(0, 48),
        full: text,
        location: res.headers.get('location'),
        cacheControl: res.headers.get('cache-control'),
    };
}

// The session route answers on a public path, so the home page can ask.
const allowedEnv = { ...env, ACCESS_LOCAL_BYPASS: 'true' };
async function hitLocal(path, overrideEnv) {
    const res = await worker.fetch(new Request('http://localhost' + path), overrideEnv ?? env, ctx);
    return {
        status: res.status,
        body: await res.text(),
        cacheControl: res.headers.get('cache-control'),
    };
}

const sessionOpen = await hitLocal('/api/session', allowedEnv);
const sessionShut = await hitLocal('/api/session');
const sessionPublic = await hit('/api/session');

const cases = [
    [
        'home page serves an asset',
        await hit('/'),
        r => r.status === 200 && r.body.startsWith('asset:/'),
    ],
    [
        'session says yes to owner',
        sessionOpen,
        r => r.status === 200 && JSON.parse(r.body).allowed === true,
    ],
    [
        'session says no by default',
        sessionShut,
        r => r.status === 200 && JSON.parse(r.body).allowed === false,
    ],
    [
        'session says no to public',
        sessionPublic,
        r => r.status === 200 && JSON.parse(r.body).allowed === false,
    ],
    ['session leaks no email', sessionPublic, r => !r.body.includes('@')],
    ['session is never cached', sessionPublic, r => r.cacheControl === 'no-store'],
    ['session never gates itself', sessionPublic, r => r.status !== 302 && r.status !== 503],
    ['css serves an asset', await hit('/css/tokens.css'), r => r.body === 'asset:/css/tokens.css'],
    [
        'vocabulary returns json',
        await hit('/api/vocabulary'),
        r => r.status === 200 && r.full.includes('watercolor'),
    ],
    [
        'vocabulary lists both sets',
        await hit('/api/vocabulary'),
        r => {
            const v = JSON.parse(r.full);
            return Array.isArray(v.tags) && Array.isArray(v.mediums);
        },
    ],
    [
        'vocabulary counts a medium',
        await hit('/api/vocabulary'),
        r => JSON.parse(r.full).mediums.some(m => m.value === 'ink' && m.count === 1),
    ],
    [
        'metadata returns json',
        await hit('/api/image-metadata'),
        r => r.status === 200 && r.full.includes('Piece One'),
    ],
    [
        'metadata names the kind',
        await hit('/api/image-metadata'),
        r => JSON.parse(r.full)[0].kind === 'image',
    ],
    [
        'an old medium is promoted',
        await hit('/api/image-metadata'),
        r => {
            const row = JSON.parse(r.full)[0];
            return JSON.stringify(row.mediums) === '["ink"]' && row.medium === undefined;
        },
    ],
    [
        'an old filename is promoted',
        await hit('/api/image-metadata'),
        r => {
            const row = JSON.parse(r.full)[0];
            return (
                row.images.length === 1 &&
                row.images[0].key === 'piece-one.jpg' &&
                row.filename === undefined
            );
        },
    ],
    [
        'the promoted size is read',
        await hit('/api/image-metadata'),
        r => {
            const image = JSON.parse(r.full)[0].images[0];
            return image.width === 4 && image.height === 3;
        },
    ],
    ['images needs an id', await hit('/api/images'), r => r.status === 400],
    [
        'images serves a small copy',
        await hit('/api/images?id=thumbs/piece-one.jpg.webp'),
        r => r.status === 200,
    ],
    [
        'images cache for a day',
        await hit('/api/images?id=thumbs/piece-one.jpg.webp'),
        r => r.cacheControl === 'public, max-age=86400',
    ],
    [
        'images answer 304 to a held etag',
        await hit('/api/images?id=thumbs/piece-one.jpg.webp', {
            headers: { 'If-None-Match': '"e"' },
        }),
        r => r.status === 304 && r.full === '',
    ],
    [
        'images resend after a changed etag',
        await hit('/api/images?id=thumbs/piece-one.jpg.webp', {
            headers: { 'If-None-Match': '"old"' },
        }),
        r => r.status === 200,
    ],
    [
        'images refuses a message',
        await hit('/api/images?id=messages/a.json'),
        r => r.status === 404,
    ],
    ['images refuses a download', await hit('/api/images?id=files/a.pdf'), r => r.status === 404],
    [
        'images refuses a walk up',
        await hit('/api/images?id=thumbs/../a.jpg'),
        r => r.status === 404,
    ],
    ['files refuses an artwork', await hit('/api/files?key=piece-one.jpg'), r => r.status === 404],
    [
        'metadata refuses a post',
        await hit('/api/image-metadata', { method: 'POST' }),
        r => r.status === 405,
    ],
    ['unknown api is 404', await hit('/api/nope'), r => r.status === 404],
    ['upload page is gated', await hit('/pages/upload'), r => r.status === 503],
    ['upload post is gated', await hit('/api/upload', { method: 'POST' }), r => r.status === 503],
    [
        'upload delete is gated',
        await hit('/api/upload?id=x', { method: 'DELETE' }),
        r => r.status === 503,
    ],
    ['edit page is gated', await hit('/pages/edit'), r => r.status === 503],
];

let failed = 0;
for (const [label, result, check] of cases) {
    const pass = check(result);
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(28)} ${String(result.status).padEnd(4)} ${result.body}`
    );
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
