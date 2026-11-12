// Home page wiring: the pannable plane, the photo wall, and the side drawer.
import { createPan } from './components/pan.js';
import { renderMosaic } from './components/mosaic.js';
import { createLoadingScreen } from './components/loading-screen.js';
import { openDetail } from './components/detail-modal.js';
import { api } from './api.js';

const CENTERED_PX = 0.5; // distance from origin still counted as centered
const CENTERED_SCALE = 0.005; // zoom gap still counted as 100 percent
const BUTTON_ZOOM_STEP = 1.25;

const viewport = document.getElementById('viewport');
const plane = document.getElementById('plane');
const mosaic = document.getElementById('mosaic');
const card = document.getElementById('card');
const recenterButton = document.getElementById('recenter');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const menu = document.getElementById('menu');
const menuToggle = document.getElementById('menu-toggle');
const menuPanel = document.getElementById('menu-panel');
const menuScrim = document.getElementById('menu-scrim');
const menuPrivateItems = document.querySelectorAll('.menu-private');
const loadingScreen = document.getElementById('loading-screen');

/* ---------- Pan ---------- */

const pan = createPan({ surface: viewport, onChange: applyPan });

function applyPan(view) {
    plane.style.transform = `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`;

    // Recenter shows once the view sits away from the origin, or off 100%.
    const atRest =
        Math.abs(view.x) < CENTERED_PX &&
        Math.abs(view.y) < CENTERED_PX &&
        Math.abs(view.scale - 1) < CENTERED_SCALE;

    recenterButton.classList.toggle('is-hidden', atRest);
}

recenterButton.addEventListener('click', () => pan.recenter());
zoomInButton.addEventListener('click', () => pan.zoomBy(BUTTON_ZOOM_STEP));
zoomOutButton.addEventListener('click', () => pan.zoomBy(1 / BUTTON_ZOOM_STEP));

// A drag that happens to end on the gallery link must not follow it.
plane.addEventListener(
    'click',
    event => {
        if (!pan.wasDragged()) return;
        event.preventDefault();
        event.stopPropagation();
    },
    true
);

/* ---------- Drawer ---------- */

function isMenuOpen() {
    return menu.classList.contains('is-open');
}

function setMenuOpen(open) {
    if (open === isMenuOpen()) return;

    menu.classList.toggle('is-open', open);
    menuScrim.classList.toggle('is-visible', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');

    const firstLink = menuPanel.querySelector('a');
    if (open && firstLink) firstLink.focus();
    else if (!open) menuToggle.focus();
}

menuToggle.addEventListener('click', () => setMenuOpen(!isMenuOpen()));
menuScrim.addEventListener('click', () => setMenuOpen(false));

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMenuOpen(false);
});

/* ---------- Private links ---------- */

// These links are a courtesy, not a lock. src/gate.js blocks the routes, so a
// visitor who unhides an item still lands on the Access login page.
async function showPrivateLinksIfAllowed() {
    try {
        const { allowed } = await api.session();
        menuPrivateItems.forEach(item => {
            item.hidden = !allowed;
        });
    } catch {
        // Leave the link hidden.
    }
}

/* ---------- Photo wall ---------- */

// index.html carries the cover, so it paints with the document and nobody
// sees the title before it. The cover goes once every picture of the first
// screen answers, or after its own time limit. A failure must not leave the
// cover up, so the catch drops it.
const cover = createLoadingScreen({ screen: loadingScreen });

applyPan({ x: 0, y: 0, scale: 1 });
showPrivateLinksIfAllowed();

// A click on a tile opens the same detail view the gallery grid opens.
renderMosaic({ container: mosaic, card, onSelect: openDetail })
    .then(wall => {
        wall.covers.forEach(img => cover.track(img));
        return cover.seal();
    })
    .catch(() => cover.finish());
