// The shared detail view, under a DOM stub. No browser, no network.
//
// The photo wall and the gallery grid both open this view, so the cases below
// stand for both pages.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function stubDom() {
    const make = () => {
        const node = {
            className: '',
            textContent: '',
            children: [],
            parent: null,
            attrs: {},
            listeners: {},
            style: {
                _v: {},
                setProperty(name, value) {
                    this._v[name] = value;
                },
            },
            appendChild(child) {
                child.parent = node;
                node.children.push(child);
                return child;
            },
            append(...kids) {
                kids.forEach(kid => node.appendChild(kid));
            },
            remove() {
                if (!node.parent) return;
                node.parent.children = node.parent.children.filter(kid => kid !== node);
                node.parent = null;
            },
            setAttribute(name, value) {
                node.attrs[name] = value;
            },
            addEventListener(name, fn) {
                (node.listeners[name] ||= []).push(fn);
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
                // The real toggle reports the state it left behind, and
                // js/components/detail-modal.js reads that answer.
                toggle(name, on) {
                    const next = on === undefined ? !this.contains(name) : Boolean(on);
                    next ? this.add(name) : this.remove(name);
                    return next;
                },
            },
        };
        return node;
    };

    const page = { listeners: {} };

    globalThis.document = {
        createElement: make,
        body: make(),
        addEventListener(name, fn) {
            (page.listeners[name] ||= []).push(fn);
        },
        removeEventListener(name, fn) {
            page.listeners[name] = (page.listeners[name] || []).filter(kid => kid !== fn);
        },
    };

    return page;
}
const page = stubDom();

const { openDetail } = await import(`${ROOT}/public/js/components/detail-modal.js`);

const results = [];
const check = (label, got, want) =>
    results.push([label, JSON.stringify(got), JSON.stringify(want)]);

// Walks the tree for the first node that carries a class.
function find(node, name) {
    if (node.classList && node.classList.contains(name)) return node;

    for (const child of node.children || []) {
        const hit = find(child, name);
        if (hit) return hit;
    }

    return null;
}

function openCount() {
    return document.body.children.filter(node => node.classList.contains('modal-overlay')).length;
}

function press(key) {
    (page.listeners.keydown || []).forEach(fn => fn({ key }));
}

function click(node) {
    (node.listeners.click || []).forEach(fn => fn({ stopPropagation() {} }));
}

const PIECE = {
    id: 'blue-hour',
    name: 'Blue Hour',
    dateCreated: '2026-04-02',
    mediums: ['watercolor'],
    tags: ['landscape'],
    description: 'A first line.\n\nA second block.',
    images: [
        { key: 'one.jpg', thumb: 'thumbs/one.jpg.webp' },
        { key: 'two.jpg', thumb: 'thumbs/two.jpg.webp' },
        { key: 'three.jpg', thumb: 'thumbs/three.jpg.webp' },
    ],
};

/* ---------- A piece, with pictures and words ---------- */

const piece = openDetail(PIECE);
const stage = find(piece.element, 'detail-stage');

check('the overlay opens on the body', openCount(), 1);
check('the view is the stage layout', Boolean(stage), true);
check('the words sit in a panel', Boolean(find(piece.element, 'detail-panel')), true);
check('the panel starts closed', stage.classList.contains('is-open'), false);
check('the name shows', find(piece.element, 'detail-name').textContent, 'Blue Hour');
check('the date shows', find(piece.element, 'detail-date').textContent, '2026-04-02');
check('a blank line starts a paragraph', find(piece.element, 'detail-text').children.length, 2);
check('a medium takes a pill', Boolean(find(piece.element, 'pill-medium')), true);
check('a tag takes its own pill', Boolean(find(piece.element, 'pill-tag')), true);

// A click on a pill opens the gallery, filtered by that term.
check(
    'a medium pill filters the gallery',
    find(piece.element, 'pill-medium').href,
    '/pages/gallery?medium=watercolor'
);
check(
    'a tag pill filters the gallery',
    find(piece.element, 'pill-tag').href,
    '/pages/gallery?tag=landscape'
);

// The detail view shows the full picture, never the small copy.
const picture = find(piece.element, 'slides-image');
check('the first picture shows', picture.src, '/api/images?id=one.jpg');

const dots = find(piece.element, 'slides-dots');
check('one dot for each picture', dots.children.length, 3);
check('the first dot is on', dots.children[0].classList.contains('is-on'), true);

click(find(piece.element, 'is-next'));
check('next shows the second picture', picture.src, '/api/images?id=two.jpg');
check('next moves the dot', dots.children[1].classList.contains('is-on'), true);
check('next leaves the first dot', dots.children[0].classList.contains('is-on'), false);

click(dots.children[2]);
check('a dot shows its own picture', picture.src, '/api/images?id=three.jpg');

click(find(piece.element, 'is-next'));
check('the last picture wraps to the first', picture.src, '/api/images?id=one.jpg');

click(find(piece.element, 'is-prev'));
check('before the first wraps to the last', picture.src, '/api/images?id=three.jpg');

// The handle pulls the words out, and pushes them back. It carries a caret
// and a word, and the word names the action.
const handle = find(piece.element, 'detail-handle');
const caret = find(piece.element, 'detail-handle-caret');
const word = find(piece.element, 'detail-handle-word');

check('the handle names the panel', word.textContent, 'Description');
check('the caret points at the words', caret.textContent, '‹');
check('the caret is not read aloud', caret.attrs['aria-hidden'], 'true');

click(handle);
check('the handle opens the panel', stage.classList.contains('is-open'), true);
check('the handle reports open', handle.attrs['aria-expanded'], 'true');
check('the handle turns around', caret.textContent, '›');
check('the word stays put', word.textContent, 'Description');

click(handle);
check('the handle closes the panel', stage.classList.contains('is-open'), false);
check('the handle reports closed', handle.attrs['aria-expanded'], 'false');
check('the caret turns back', caret.textContent, '‹');

/* ---------- Taking the view away ---------- */

press('Escape');
check('Escape closes the view', openCount(), 0);
check('Escape drops the key listener', (page.listeners.keydown || []).length, 0);

const backdrop = openDetail(PIECE);
click(backdrop.element);
check('the backdrop closes the view', openCount(), 0);

const shut = openDetail(PIECE);
check('the cross rides the backdrop', Boolean(find(shut.element, 'detail-close')), true);
click(find(shut.element, 'detail-close'));
check('the cross closes the view', openCount(), 0);

// Two views must never stack.
openDetail(PIECE);
openDetail({ ...PIECE, id: 'second' });
check('a second open closes the first', openCount(), 1);
openDetail(null);
check('no row closes the view and opens nothing', openCount(), 0);

/* ---------- The other two kinds ---------- */

const code = openDetail({
    id: 'portfolio',
    kind: 'code',
    name: 'Portfolio site',
    language: 'javascript',
    snippet: 'const a = 1;',
    repoUrl: 'https://example.com/repo',
    liveUrl: 'https://example.com/live',
    download: { key: 'files/portfolio-notes.pdf', name: 'notes.pdf' },
    images: [],
});

check('a code project reads as a document', Boolean(find(code.element, 'detail-document')), true);
check(
    'a code project with no picture shows code',
    Boolean(find(code.element, 'detail-code')),
    true
);

const actions = find(code.element, 'modal-actions');
check('the actions hold repo, live and download', actions.children.length, 3);
check('a code document shows the same cross', Boolean(find(code.element, 'detail-close')), true);
check('an outside link tells the new tab nothing', actions.children[0].rel, 'noopener noreferrer');
check(
    'the download points at the file route',
    actions.children[2].href.startsWith('/api/files?'),
    true
);
code.close();

// A row with no picture takes a color panel, steady from its id.
const bare = openDetail({ id: 'untitled-7' });
const panel = find(bare.element, 'modal-panel');
check('a row with no picture shows a panel', Boolean(panel), true);
check(
    'the panel color comes from the id',
    /^var\(--blank-[1-8]\)$/.test(panel.style._v['--panel']),
    true
);
check('a row with no words needs no handle', find(bare.element, 'detail-handle'), null);

// A row with no links would leave an empty action row, and that row carries a
// margin. So the row stays away.
check('a row with no links draws no action row', find(bare.element, 'modal-actions'), null);
check('a row with no links still closes', Boolean(find(bare.element, 'detail-close')), true);
// The frame holds the view and the cross side by side. So an open words
// panel widens the view and pushes the cross further right.
const frame = bare.element.children[0];
check('the backdrop holds one frame', frame.classList.contains('modal-frame'), true);
check('the frame holds the view, then the cross', frame.children.length, 2);
check('the view comes first', frame.children[0].classList.contains('modal-content'), true);
check('the cross stands beside it', frame.children[1].classList.contains('detail-close'), true);
bare.close();

const named = openDetail({ id: 'untitled-7', panelColor: 4 });
check(
    'a named color wins',
    find(named.element, 'modal-panel').style._v['--panel'],
    'var(--blank-4)'
);
named.close();

check('every view is gone at the end', openCount(), 0);

let failed = 0;
for (const [label, got, want] of results) {
    const pass = got === want;
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(44)} ${got}${pass ? '' : `  want ${want}`}`
    );
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
