// The side drawer, under a DOM stub. No browser, no network.
//
// Every page mounts the same component, so the cases below stand for all of
// them. The link list itself is the fact under test: one file holds it.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function make(tag = 'div') {
    const node = {
        tag,
        className: '',
        textContent: '',
        href: '',
        id: '',
        hidden: false,
        children: [],
        attrs: {},
        listeners: {},
        focused: 0,
        appendChild(child) {
            node.children.push(child);
            return child;
        },
        replaceChildren(...kids) {
            node.children = kids;
        },
        setAttribute(name, value) {
            node.attrs[name] = value;
        },
        focus() {
            node.focused += 1;
        },
        addEventListener(name, fn) {
            (node.listeners[name] ||= []).push(fn);
        },
        querySelector(selector) {
            return query(node, selector);
        },
        classList: {
            names() {
                return node.className.split(/\s+/).filter(Boolean);
            },
            contains(name) {
                return this.names().includes(name);
            },
            add(name) {
                if (!this.contains(name)) node.className = [...this.names(), name].join(' ');
            },
            remove(name) {
                node.className = this.names()
                    .filter(word => word !== name)
                    .join(' ');
            },
            toggle(name, on) {
                const next = on === undefined ? !this.contains(name) : Boolean(on);
                next ? this.add(name) : this.remove(name);
                return next;
            },
        },
    };
    return node;
}

function hits(node, selector) {
    return selector.startsWith('.')
        ? node.classList.contains(selector.slice(1))
        : node.tag === selector;
}

function query(node, selector) {
    for (const child of node.children || []) {
        if (hits(child, selector)) return child;

        const deep = query(child, selector);
        if (deep) return deep;
    }

    return null;
}

const page = { listeners: {} };
let allowed = true;

globalThis.document = {
    createElement: make,
    body: make('body'),
    addEventListener(name, fn) {
        (page.listeners[name] ||= []).push(fn);
    },
    removeEventListener() {},
};
globalThis.location = { pathname: '/pages/about' };

// public/js/api.js reads the body as text, then parses it.
globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ allowed }),
});

const { mountMenu, linkOf, MENU_LINKS } = await import(`${ROOT}/public/js/components/menu.js`);

const results = [];
const check = (label, got, want) =>
    results.push([label, JSON.stringify(got), JSON.stringify(want)]);

// The drawer shell every page carries in its markup.
function shell() {
    const nav = make('nav');
    nav.className = 'menu';

    const toggle = make('button');
    toggle.className = 'menu-toggle';

    const panel = make('div');
    panel.className = 'menu-panel';

    nav.appendChild(toggle);
    nav.appendChild(panel);

    return { nav, toggle, panel };
}

function anchors(panel) {
    return panel.children[0].children.map(item => item.children[0]);
}

function press(key) {
    (page.listeners.keydown || []).forEach(fn => fn({ key }));
}

function click(node) {
    (node.listeners.click || []).forEach(fn => fn({}));
}

// Each mount adds its own scrim to the body. A case must hold the one its
// own mount added, not the last one on the page.
function scrimAfter(before) {
    return document.body.children[before];
}

/* ---------- The link list ---------- */

// One page the menu names must stay reachable. Home is the one this change
// added, and the home page itself no longer shows a Back to home button.
check('the menu names the home page first', MENU_LINKS[0].href, '/');
check(
    'the menu names every page once',
    MENU_LINKS.length,
    new Set(MENU_LINKS.map(l => l.href)).size
);

// The asset router answers one page at three paths, and a query names none.
check('a bare slash is the home page', linkOf('/'), '/');
check('an empty path is the home page', linkOf(''), '/');
check('a trailing slash drops', linkOf('/pages/about/'), '/pages/about');
check('an html suffix drops', linkOf('/pages/about.html'), '/pages/about');
check('a query never names the page', linkOf('/pages/upload?id=blue-hour'), '/pages/upload');
check('a hash never names the page', linkOf('/pages/contact#form'), '/pages/contact');

/* ---------- One page, marked ---------- */

const about = shell();
const scrimsBefore = document.body.children.length;
const drawer = mountMenu(about.nav);
const scrim = scrimAfter(scrimsBefore);
const links = anchors(about.panel);

check('the panel holds every link', links.length, MENU_LINKS.length);
check('the first link goes home', links[0].href, '/');
check('the first link reads Home', links[0].textContent, 'Home');

const marked = links.filter(link => link.attrs['aria-current'] === 'page');
check('one link reads as current', marked.length, 1);
check('the current link is this page', marked[0].href, '/pages/about');

// A path the menu does not name marks nothing.
const stray = shell();
mountMenu(stray.nav, { current: '/pages/nowhere' });
check(
    'an unnamed page marks nothing',
    anchors(stray.panel).every(link => !link.attrs['aria-current']),
    true
);

// The same page reached by its file name still marks the link.
const suffix = shell();
mountMenu(suffix.nav, { current: '/pages/contact.html' });
check(
    'a file name still marks the link',
    anchors(suffix.panel).find(link => link.attrs['aria-current'] === 'page').href,
    '/pages/contact'
);

/* ---------- Opening and closing ---------- */

check('the drawer starts closed', about.nav.classList.contains('is-open'), false);

click(about.toggle);
check('the button opens the drawer', about.nav.classList.contains('is-open'), true);
check('the button reports open', about.toggle.attrs['aria-expanded'], 'true');
check('the button offers to close', about.toggle.attrs['aria-label'], 'Close menu');
check('the scrim shows', scrim.classList.contains('is-visible'), true);
check('the first link takes focus', links[0].focused, 1);

click(about.toggle);
check('the button closes the drawer', about.nav.classList.contains('is-open'), false);
check('the scrim goes', scrim.classList.contains('is-visible'), false);
check('the button takes focus back', about.toggle.focused, 1);

drawer.open();
click(scrim);
check('the scrim closes the drawer', about.nav.classList.contains('is-open'), false);

drawer.open();
press('Escape');
check('Escape closes the drawer', about.nav.classList.contains('is-open'), false);

/* ---------- The private links ---------- */

const owner = shell();
mountMenu(owner.nav);
const gated = () =>
    owner.panel.children[0].children.filter(item => item.className === 'menu-private');

check(
    'a private link starts hidden',
    gated().every(item => item.hidden),
    true
);

await new Promise(resolve => setTimeout(resolve, 0));
check(
    'the owner sees the private links',
    gated().every(item => !item.hidden),
    true
);
check('four links wait for the session', gated().length, 4);

allowed = false;
const guest = shell();
mountMenu(guest.nav);
await new Promise(resolve => setTimeout(resolve, 0));
check(
    'a visitor sees no private link',
    guest.panel.children[0].children
        .filter(item => item.className === 'menu-private')
        .every(item => item.hidden),
    true
);

/* ---------- A page with no drawer ---------- */

// The editor of one row shows the Edit list button alone, so its page hands
// over nothing and the component must not throw.
check('no nav mounts nothing', mountMenu(null), null);

const bare = make('nav');
bare.className = 'menu';
check('a nav with no button mounts nothing', mountMenu(bare), null);

let failed = 0;
for (const [label, got, want] of results) {
    const pass = got === want;
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(40)} ${got}${pass ? '' : `  want ${want}`}`
    );
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
