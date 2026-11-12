// The loading cover, under a DOM stub. No browser, no network.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function stubDom() {
    const make = () => {
        const node = {
            className: '',
            textContent: '',
            children: [],
            attrs: {},
            listeners: {},
            style: { setProperty() {} },
            appendChild(child) {
                this.children.push(child);
                return child;
            },
            append(...kids) {
                kids.forEach(kid => this.children.push(kid));
            },
            remove() {
                node.removed = true;
            },
            setAttribute(key, value) {
                this.attrs[key] = value;
            },
            addEventListener(name, fn) {
                (this.listeners[name] ||= []).push(fn);
            },
            getBoundingClientRect: () => ({ top: 0, left: 0, bottom: 100, right: 100 }),
            classList: {
                add(name) {
                    if (!node.className.includes(name)) node.className += ` ${name}`;
                },
                remove(name) {
                    node.className = node.className.replace(name, '').trim();
                },
                toggle(name, on) {
                    on ? this.add(name) : this.remove(name);
                },
                contains(name) {
                    return node.className.includes(name);
                },
            },
        };
        return node;
    };

    globalThis.document = { createElement: make, body: make() };
    globalThis.window = { innerWidth: 1512, innerHeight: 864 };
    globalThis.performance = { now: () => 0 };
    return make;
}
const make = stubDom();

const { createLoadingScreen, fillOrder, litCells, onFirstScreen } = await import(
    `${ROOT}/public/js/loading-screen.js`
);

const results = [];
const check = (label, got, want) =>
    results.push([label, JSON.stringify(got), JSON.stringify(want)]);

// The block fills from the middle outward, the shape of the photo wall.
const order = fillOrder(4);
check(
    'the order covers every square',
    [...order].sort((a, b) => a - b),
    Array.from({ length: 16 }, (_, i) => i)
);
check(
    'the four middle squares come first',
    order.slice(0, 4).sort((a, b) => a - b),
    [5, 6, 9, 10]
);
check(
    'the four corners come last',
    order.slice(12).sort((a, b) => a - b),
    [0, 3, 12, 15]
);

// The count drives the block. An unknown total must not look finished.
check('no total lights nothing', litCells(0, 0), 0);
check('no answer lights nothing', litCells(0, 20), 0);
check('half the answers light half', litCells(10, 20), 8);
check('one short of all holds a square back', litCells(19, 20), 15);
check('every answer fills the block', litCells(20, 20), 16);
check('a late extra cannot pass the block', litCells(25, 20), 16);
check('one picture fills the block', litCells(1, 1), 16);

// Only a picture the window shows counts, because a lazy picture below the
// fold never starts a request.
const view = { width: 1000, height: 800 };
const rect = (top, bottom) => ({ top, bottom, left: 0, right: 500 });
check('a card on screen counts', onFirstScreen(rect(10, 250), view), true);
check('a card just below counts', onFirstScreen(rect(820, 1060), view), true);
check('a card far below does not', onFirstScreen(rect(2000, 2240), view), false);
check('a card scrolled past does not', onFirstScreen(rect(-900, -660), view), false);

// The cover opens at once, counts each answer, and goes after the last one.
function picture({ complete = false } = {}) {
    const img = make();
    img.complete = complete;
    return img;
}

function litCount(cover) {
    return cover.element.children[0].children.filter(cell => cell.className.includes('is-on'))
        .length;
}

const cover = createLoadingScreen({ root: make() });
check('the cover opens', cover.element.className.includes('loading-screen'), true);
check('it locks the page', document.body.className.includes('is-loading'), true);
check('it shows the block and the text only', cover.element.children.length, 2);
check('the text reads Loading', cover.element.children[1].textContent, 'Loading');
check('it starts empty', litCount(cover), 0);

const shown = [picture(), picture(), picture(), picture()];
shown.forEach(img => cover.track(img));
check('no answer lights no square', litCount(cover), 0);

cover.track(shown[0]);
check('a second register adds no listener', shown[0].listeners.load.length, 1);

shown[0].listeners.load[0]();
check('one answer of four lights four squares', litCount(cover), 4);

shown[1].listeners.error[0]();
check('a failed picture still counts', litCount(cover), 8);

const offScreen = make();
offScreen.getBoundingClientRect = () => ({ top: 4000, bottom: 4240, left: 0, right: 200 });
cover.track(offScreen);
check('a card below the fold is skipped', litCount(cover), 8);

cover.seal();
check('the cover waits for the last two', cover.element.className.includes('is-gone'), false);

shown[2].listeners.load[0]();
shown[3].listeners.load[0]();
await new Promise(resolve => setTimeout(resolve, 700));
check('the block finishes', litCount(cover), 16);
check('the cover goes', cover.element.className.includes('is-gone'), true);
check('it unlocks the page', document.body.className.includes('is-loading'), false);

// A cached picture answers before any event, so the cover must not hang.
const cached = createLoadingScreen({ root: make() });
cached.track(picture({ complete: true }));
check('a cached picture counts at once', litCount(cached), 16);
await cached.seal();
check('a cached page clears the cover', cached.element.className.includes('is-gone'), true);

// A page with no pictures must clear too.
const bare = createLoadingScreen({ root: make() });
await bare.seal();
check('a page with no pictures clears', bare.element.className.includes('is-gone'), true);

let failed = 0;
for (const [label, got, want] of results) {
    const pass = got === want;
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(38)} ${got}${pass ? '' : `  want ${want}`}`
    );
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
