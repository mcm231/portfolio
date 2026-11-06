// The cover that hides a page until its first screen of pictures arrives.
//
// The block fills one square for each answered image request, so the cover
// follows the network instead of a timer. It counts a picture the window
// shows now, and nothing else: a lazy picture below the fold never starts a
// request, so waiting for one would hold the cover forever.
//
// Styling lives in css/styles.css per STYLE_GUIDE.md. This file sets class
// names only. The block carries the progress, so the cover shows one word and
// no count.

const SIDE = 4;              // squares across the block
const CELLS = SIDE * SIDE;
const TINTS = 3;             // teal shades, as .tint-0 .. .tint-2
const LEAST_MS = 300;        // the cover stays this long, so it never blinks
const GIVE_UP_MS = 10000;    // a stalled picture must not trap a visitor
const FADE_MS = 260;         // matches .loading-screen in css/styles.css
const MARGIN = 120;          // px past the window edge still counted as shown
const LABEL = 'Loading';     // every page shows this one word, and no count

// Fill order of the squares: nearest the middle first. The block grows
// outward from its center, the way the photo wall grows from the title card.
export function fillOrder(side = SIDE) {
    return Array.from({ length: side * side }, (_, index) => ({
        index,
        distance: Math.hypot(index % side + 0.5 - side / 2,
                             Math.floor(index / side) + 0.5 - side / 2)
    }))
        .sort((a, b) => a.distance - b.distance)
        .map(cell => cell.index);
}

// How many squares light up for `done` of `total` requests.
//
// An unknown total lights none, because the count is not known yet. A full
// block means every request answered, so the last square waits for the last
// picture.
export function litCells(done, total, cells = CELLS) {
    if (total <= 0) return 0;
    if (done >= total) return cells;
    return Math.min(cells - 1, Math.floor((done / total) * cells));
}

// True when the window shows this rectangle now, give or take a margin.
export function onFirstScreen(rect, view, margin = MARGIN) {
    return rect.bottom > -margin && rect.top < view.height + margin
        && rect.right > -margin && rect.left < view.width + margin;
}

// Opens the cover at once and returns the handle a page drives:
//
//   track(img)  register one picture. A picture off the first screen, or one
//               already registered, is ignored.
//   seal()      no more pictures arrive. Returns a promise that resolves
//               after the cover goes.
//   finish()    drop the cover now, whatever is outstanding.
export function createLoadingScreen({ root = document.body } = {}) {
    const order = fillOrder();
    const cells = [];

    const block = document.createElement('div');
    block.className = 'loading-block';
    block.setAttribute('aria-hidden', 'true');

    for (let index = 0; index < CELLS; index++) {
        const cell = document.createElement('span');
        cell.className = `loading-cell tint-${index % TINTS}`;
        block.appendChild(cell);
        cells.push(cell);
    }

    const labelNode = document.createElement('p');
    labelNode.className = 'loading-label';
    labelNode.textContent = LABEL;

    const screen = document.createElement('div');
    screen.className = 'loading-screen';
    screen.setAttribute('role', 'status');
    screen.append(block, labelNode);

    const tracked = new WeakSet();
    let total = 0;
    let done = 0;
    let sealed = false;
    let gone = false;
    let timer = null;

    const bornAt = now();
    let settle;
    const finished = new Promise(resolve => { settle = resolve; });

    root.appendChild(screen);
    document.body.classList.add('is-loading');
    paint();

    function now() {
        return typeof performance === 'object' ? performance.now() : 0;
    }

    function paint() {
        const lit = litCells(done, total);

        for (let step = 0; step < CELLS; step++) {
            const cell = cells[order[step]];
            cell.classList.toggle('is-on', step < lit);
            cell.classList.toggle('is-next', step === lit);
        }
    }

    // The block completes before the cover goes, so it never leaves a hole.
    function fill() {
        for (const cell of cells) {
            cell.classList.add('is-on');
            cell.classList.remove('is-next');
        }
    }

    function answered() {
        done += 1;
        paint();
        if (sealed && done >= total) finish();
    }

    function track(img) {
        if (gone || !img || tracked.has(img)) return;

        const rect = img.getBoundingClientRect();
        const view = { width: window.innerWidth, height: window.innerHeight };
        if (!onFirstScreen(rect, view)) return;

        tracked.add(img);
        total += 1;

        if (img.complete) {
            answered();
            return;
        }

        img.addEventListener('load', answered, { once: true });
        img.addEventListener('error', answered, { once: true });
        paint();
    }

    function seal() {
        if (!sealed) {
            sealed = true;
            timer = setTimeout(finish, GIVE_UP_MS);
            if (done >= total) finish();
        }

        return finished;
    }

    function finish() {
        if (gone) return finished;
        gone = true;

        if (timer !== null) clearTimeout(timer);
        fill();

        // A fast answer must still show the block, or the cover blinks.
        setTimeout(() => {
            screen.classList.add('is-gone');
            document.body.classList.remove('is-loading');
            setTimeout(() => {
                screen.remove();
                settle();
            }, FADE_MS);
        }, Math.max(0, LEAST_MS - (now() - bornAt)));

        return finished;
    }

    return { track, seal, finish, element: screen };
}
