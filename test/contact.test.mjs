// The contact endpoint and the inbox, against stub bindings. No network,
// and nothing written to the real bucket.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const worker = (await import(`${ROOT}/src/index.js`)).default;

const r2 = new Map();
const sent = [];

const env = {
    ACCESS_LOCAL_BYPASS: 'true', // the host below is localhost
    IMAGE_METADATA: {
        async get() {
            return null;
        },
        async list() {
            return { keys: [], list_complete: true };
        },
    },
    IMAGES: {
        async put(k, v) {
            r2.set(k, v);
        },
        async get(k) {
            return r2.has(k)
                ? {
                      async text() {
                          return r2.get(k);
                      },
                  }
                : null;
        },
        async delete(k) {
            r2.delete(k);
        },
        async list({ prefix }) {
            return {
                objects: [...r2.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })),
                truncated: false,
            };
        },
    },
    RESEND_API_KEY: 'test-key',
    CONTACT_TO: 'maya@example.com',
    CONTACT_FROM: 'contact@example.com',
    ASSETS: {
        async fetch() {
            return new Response('asset');
        },
    },
};

const ctx = { waitUntil() {} };

// src/api/_mail.js posts to the provider. Nothing leaves this process.
let mailAnswers = true;
globalThis.fetch = async (url, init) => {
    sent.push({ url, ...JSON.parse(init.body) });

    return mailAnswers
        ? {
              ok: true,
              status: 200,
              async text() {
                  return '{"id":"stub"}';
              },
          }
        : {
              ok: false,
              status: 422,
              async text() {
                  return 'refused';
              },
          };
};

async function post(fields, overrideEnv) {
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);

    const res = await worker.fetch(
        new Request('http://localhost/api/contact', { method: 'POST', body }),
        overrideEnv ?? env,
        ctx
    );
    return { status: res.status, json: await res.json() };
}

const GOOD = {
    name: 'A Visitor',
    email: 'visitor@example.com',
    subject: 'Hello',
    message: 'A note.',
};

const results = [];
const check = (label, got, want) =>
    results.push([label, JSON.stringify(got), JSON.stringify(want)]);

const first = await post(GOOD);
check('a good message is stored', first.status, 201);
check('it reports sent', first.json.sent, true);
check('it reports mailed', first.json.mailed, true);
check('one object is written', r2.size, 1);
check('the key sits under messages/', [...r2.keys()][0].startsWith('messages/'), true);

const stored = JSON.parse([...r2.values()][0]);
check('the record keeps the name', stored.name, 'A Visitor');
check('the record keeps the email', stored.email, 'visitor@example.com');
check('the record keeps the body', stored.message, 'A note.');

check('the record starts unread', stored.read, false);
check('the record starts with no reply', stored.replies, []);

check('the mail reaches the provider', sent[0].url, 'https://api.resend.com/emails');
check('the mail goes to the owner', sent[0].to, ['maya@example.com']);
check('it comes from the site address', sent[0].from.includes('contact@example.com'), true);
check('the answer goes to the visitor', sent[0].reply_to, 'visitor@example.com');
check('the mail carries the whole message', sent[0].text.includes('A note.'), true);
check('the mail links to the inbox', sent[0].text.includes('/pages/messages'), true);

// Validation.
check('no name is rejected', (await post({ ...GOOD, name: '' })).json.error, 'Give your name.');
check(
    'a bad email is rejected',
    (await post({ ...GOOD, email: 'nope' })).json.error,
    'Check the email address.'
);
check(
    'no message is rejected',
    (await post({ ...GOOD, message: '' })).json.error,
    'Write a message.'
);

const afterBad = r2.size;
check('a rejected message stores nothing', afterBad, 1);

// The honeypot answers as normal and stores nothing.
const trap = await post({ ...GOOD, website: 'https://spam.example' });
check('the honeypot looks normal', trap.json.sent, true);
check('the honeypot stores nothing', r2.size, 1);

// Without the key the message still lands.
const noMail = await post(
    { ...GOOD, message: 'No mail set up.' },
    { ...env, RESEND_API_KEY: undefined }
);
check('it stores with no mail set up', noMail.status, 201);
check('it says it did not mail', noMail.json.mailed, false);
check('two objects now', r2.size, 2);

// The inbox.
async function inbox(method = 'GET', query = '') {
    const res = await worker.fetch(
        new Request(`http://localhost/api/messages${query}`, { method }),
        env,
        ctx
    );
    return { status: res.status, json: await res.json() };
}

const listed = await inbox();
check('the inbox lists both', listed.json.messages.length, 2);
check(
    'the newest comes first',
    listed.json.messages[0].sentAt >= listed.json.messages[1].sentAt,
    true
);

const key = listed.json.messages[0].key;
const removed = await inbox('DELETE', `?key=${encodeURIComponent(key)}`);
check('a message deletes', removed.status, 200);
check('one is left', (await inbox()).json.messages.length, 1);

check('a delete needs a key', (await inbox('DELETE')).status, 400);
check('a delete stays in messages/', (await inbox('DELETE', '?key=floofball.jpg')).status, 400);

// Marking read and unread.
async function patch(body, overrideEnv) {
    const res = await worker.fetch(
        new Request('http://localhost/api/messages', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        overrideEnv ?? env,
        ctx
    );
    return { status: res.status, json: await res.json() };
}

const left = (await inbox()).json.messages[0];
check('a stored message reads as unread', left.read, false);

const marked = await patch({ key: left.key, read: true });
check('marking read answers 200', marked.status, 200);
check('the message reads as read', marked.json.message.read, true);
check('the inbox agrees', (await inbox()).json.messages[0].read, true);

const unmarked = await patch({ key: left.key, read: false });
check('marking unread puts it back', unmarked.json.message.read, false);

check('marking needs a key', (await patch({ read: true })).status, 400);
check('marking stays in messages/', (await patch({ key: 'cat.jpg', read: true })).status, 400);
check('marking needs a state', (await patch({ key: left.key })).status, 400);
check(
    'marking an unknown key is 404',
    (await patch({ key: 'messages/nope.json', read: true })).status,
    404
);

// Answering a message.
async function reply(body, overrideEnv) {
    const res = await worker.fetch(
        new Request('http://localhost/api/messages/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }),
        overrideEnv ?? env,
        ctx
    );
    return { status: res.status, json: await res.json() };
}

const before = sent.length;
const answered = await reply({ key: left.key, reply: 'Yes, prints are available.' });
check('a reply answers 200', answered.status, 200);
check('the reply leaves the site', sent.length, before + 1);
check('the reply goes to the visitor', sent[before].to, ['visitor@example.com']);
check('the reply comes from the site', sent[before].from.includes('contact@example.com'), true);
check('a visitor answers the site address', sent[before].reply_to, 'contact@example.com');
check('the subject answers the subject', sent[before].subject, 'Re: Hello');
check('the reply carries the text', sent[before].text, 'Yes, prints are available.');

check('the reply is stored', answered.json.message.replies.length, 1);
check(
    'the stored reply keeps the text',
    answered.json.message.replies[0].text,
    'Yes, prints are available.'
);
check('an answered message is read', answered.json.message.read, true);
check('the inbox keeps the reply', (await inbox()).json.messages[0].replies.length, 1);

check('a reply needs a key', (await reply({ reply: 'Hello.' })).status, 400);
check('a reply needs words', (await reply({ key: left.key, reply: '   ' })).status, 400);
check(
    'a reply needs a sender',
    (await reply({ key: left.key, reply: 'Hello.' }, { ...env, RESEND_API_KEY: undefined })).status,
    503
);

// A reply that does not leave is never stored.
mailAnswers = false;
const refused = await reply({ key: left.key, reply: 'This one fails.' });
mailAnswers = true;
check('a refused reply is 500', refused.status, 500);
check('a refused reply is not stored', (await inbox()).json.messages[0].replies.length, 1);

check('the inbox says it can reply', (await inbox()).json.canReply, true);

// The route table answers the methods it names, and refuses the rest.
const wrongMethod = await worker.fetch(
    new Request('http://localhost/api/messages', { method: 'PUT' }),
    env,
    ctx
);
check('the inbox refuses a put', wrongMethod.status, 405);
check('it names the methods it takes', wrongMethod.headers.get('allow'), 'GET, PATCH, DELETE');

// The gate covers the inbox, but never the contact form.
async function asStranger(path, method = 'GET') {
    const res = await worker.fetch(
        new Request(`https://portfolio.example${path}`, { method }),
        { ...env, ACCESS_LOCAL_BYPASS: undefined },
        ctx
    );
    return res.status;
}
check('the inbox is gated', await asStranger('/api/messages'), 503);
check('the reply route is gated', await asStranger('/api/messages/reply', 'POST'), 503);
check('the inbox page is gated', await asStranger('/pages/messages'), 503);
check('the contact form is open', (await asStranger('/api/contact', 'POST')) !== 503, true);

let failed = 0;
for (const [label, got, want] of results) {
    const pass = got === want;
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(32)} ${got}${pass ? '' : `  want ${want}`}`
    );
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
