// Signs real RS256 tokens with a throwaway key, serves them as the Access
// certs endpoint, and runs functions/_middleware.js against them.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const TEAM = 'team.cloudflareaccess.com';
const AUD = 'aud-tag-123';

const pair = await crypto.subtle.generateKey(
    {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
);
const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
jwk.kid = 'kid-1';
jwk.alg = 'RS256';
jwk.use = 'sig';

const b64 = bytes =>
    btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
const enc = obj => b64(new TextEncoder().encode(JSON.stringify(obj)));

async function makeToken(payload, kid = 'kid-1') {
    const head = enc({ alg: 'RS256', kid, typ: 'JWT' });
    const body = enc(payload);
    const sig = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        pair.privateKey,
        new TextEncoder().encode(`${head}.${body}`)
    );
    return `${head}.${body}.${b64(new Uint8Array(sig))}`;
}

globalThis.fetch = async url => {
    if (String(url).includes('/cdn-cgi/access/certs')) {
        return new Response(JSON.stringify({ keys: [jwk] }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
    throw new Error(`unexpected fetch: ${url}`);
};

const { guard } = await import(`${ROOT}/src/gate.js`);

async function run(path, { token, env = {}, host = 'portfolio.workers.dev' } = {}) {
    const headers = token ? { 'Cf-Access-Jwt-Assertion': token } : {};
    const request = new Request(`https://${host}${path}`, { headers });
    const res = await guard(request, env);
    if (res === null) return { outcome: 'served' };
    return { outcome: res.status, location: res.headers.get('location') };
}

const CONFIG = {
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
    ACCESS_ALLOWED_EMAILS: 'maya@example.com',
};
const future = Math.floor(Date.now() / 1000) + 600;
const base = { iss: `https://${TEAM}`, aud: [AUD], exp: future };

const good = await makeToken({ ...base, email: 'maya@example.com' });
const wrongUser = await makeToken({ ...base, email: 'someone@else.com' });
const expired = await makeToken({
    ...base,
    email: 'maya@example.com',
    exp: Math.floor(Date.now() / 1000) - 10,
});
const wrongAud = await makeToken({ ...base, aud: ['other-app'], email: 'maya@example.com' });
const wrongIss = await makeToken({
    ...base,
    iss: 'https://evil.cloudflareaccess.com',
    email: 'maya@example.com',
});
const unknownKid = await makeToken({ ...base, email: 'maya@example.com' }, 'kid-other');

// A token signed by a different key, same kid.
const other = await crypto.subtle.generateKey(
    {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
);
const forgedHead = enc({ alg: 'RS256', kid: 'kid-1', typ: 'JWT' });
const forgedBody = enc({ ...base, email: 'maya@example.com' });
const forgedSig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    other.privateKey,
    new TextEncoder().encode(`${forgedHead}.${forgedBody}`)
);
const forged = `${forgedHead}.${forgedBody}.${b64(new Uint8Array(forgedSig))}`;

const cases = [
    ['public page passes', await run('/', { env: CONFIG }), 'served'],
    ['public api passes', await run('/api/vocabulary', { env: CONFIG }), 'served'],
    ['no config fails closed', await run('/pages/upload', { env: {} }), 503],
    ['no token goes to login', await run('/pages/upload', { env: CONFIG }), 302],
    ['allowed user is served', await run('/pages/upload', { env: CONFIG, token: good }), 'served'],
    ['allowed user posts', await run('/api/upload', { env: CONFIG, token: good }), 'served'],
    ['wrong user is bounced', await run('/pages/upload', { env: CONFIG, token: wrongUser }), 302],
    ['expired token to login', await run('/pages/upload', { env: CONFIG, token: expired }), 302],
    [
        'wrong audience is bounced',
        await run('/pages/upload', { env: CONFIG, token: wrongAud }),
        302,
    ],
    ['wrong issuer is bounced', await run('/pages/upload', { env: CONFIG, token: wrongIss }), 302],
    ['unknown kid is bounced', await run('/pages/upload', { env: CONFIG, token: unknownKid }), 302],
    [
        'forged signature is bounced',
        await run('/pages/upload', { env: CONFIG, token: forged }),
        302,
    ],
    [
        'garbage token is bounced',
        await run('/pages/upload', { env: CONFIG, token: 'not.a.jwt' }),
        302,
    ],
    [
        'empty allow list bounces',
        await run('/pages/upload', { env: { ...CONFIG, ACCESS_ALLOWED_EMAILS: '' }, token: good }),
        302,
    ],
    [
        'bypass off on a real host',
        await run('/pages/upload', { env: { ...CONFIG, ACCESS_LOCAL_BYPASS: 'true' } }),
        302,
    ],
    [
        'bypass on localhost',
        await run('/pages/upload', { env: { ACCESS_LOCAL_BYPASS: 'true' }, host: 'localhost' }),
        'served',
    ],
    [
        'no bypass flag on localhost',
        await run('/pages/upload', { env: {}, host: 'localhost' }),
        503,
    ],
];

// Every private page and route answers the same way, to the same people.
// A new one belongs in this list, in PROTECTED_PATHS, and in run_worker_first.
const PRIVATE = [
    '/pages/upload',
    '/pages/edit',
    '/pages/messages',
    '/pages/thumbnails',
    '/api/upload',
    '/api/messages',
    '/api/thumbnail',
];

for (const path of PRIVATE) {
    cases.push([`${path} sends a stranger to login`, await run(path, { env: CONFIG }), 302]);
    cases.push([
        `${path} bounces the wrong user`,
        await run(path, { env: CONFIG, token: wrongUser }),
        302,
    ]);
    cases.push([
        `${path} serves the owner`,
        await run(path, { env: CONFIG, token: good }),
        'served',
    ]);
    cases.push([`${path} fails closed with no config`, await run(path, { env: {} }), 503]);
}

// The file name itself is gated too, so no spelling walks around the gate.
cases.push(['the file name is gated', await run('/pages/upload.html', { env: CONFIG }), 302]);

// A path below one of them is covered too.
cases.push([
    'a path under /pages/messages is gated',
    await run('/pages/messages/one', { env: CONFIG }),
    302,
]);
cases.push([
    'a path under /pages/thumbnails is gated',
    await run('/pages/thumbnails/one', { env: CONFIG }),
    302,
]);

// A public path stays public.
for (const path of [
    '/',
    '/pages/gallery',
    '/pages/contact',
    '/api/contact',
    '/api/image-metadata',
    '/api/images',
    '/api/vocabulary',
    '/api/files',
    '/api/session',
]) {
    cases.push([`${path} stays public`, await run(path, { env: CONFIG }), 'served']);
}

let failed = 0;
for (const [label, result, expected] of cases) {
    const got = result.outcome;
    const pass = got === expected;
    if (!pass) failed++;
    const where = result.location ? `  -> ${result.location.slice(0, 60)}` : '';
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(30)} ${String(got).padEnd(7)}${where}`);
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
