// Home page wiring: the pannable plane, the photo wall, and the side drawer.
import { createPan } from './pan.js';
import { renderMosaic } from './mosaic.js';

const CENTERED_PX = 0.5;   // distance from origin still counted as centered

const viewport = document.getElementById('viewport');
const plane = document.getElementById('plane');
const mosaic = document.getElementById('mosaic');
const card = document.getElementById('card');
const recenterButton = document.getElementById('recenter');
const menu = document.getElementById('menu');
const menuToggle = document.getElementById('menu-toggle');
const menuPanel = document.getElementById('menu-panel');
const menuScrim = document.getElementById('menu-scrim');
const menuPrivateItems = document.querySelectorAll('.menu-private');

/* ---------- Pan ---------- */

const pan = createPan({ surface: viewport, onChange: applyPan });

function applyPan(offset) {
    plane.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;

    const centered = Math.abs(offset.x) < CENTERED_PX && Math.abs(offset.y) < CENTERED_PX;
    recenterButton.classList.toggle('is-hidden', centered);
}

recenterButton.addEventListener('click', () => pan.recenter());

// A drag that happens to end on the gallery link must not follow it.
plane.addEventListener('click', event => {
    if (!pan.wasDragged()) return;
    event.preventDefault();
    event.stopPropagation();
}, true);

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
        const response = await fetch('/api/session', { cache: 'no-store' });
        if (!response.ok) return;

        const { allowed } = await response.json();
        menuPrivateItems.forEach(item => { item.hidden = !allowed; });
    } catch {
        // Leave the link hidden.
    }
}

/* ---------- Photo wall ---------- */

applyPan({ x: 0, y: 0 });
renderMosaic({ container: mosaic, card });
showPrivateLinksIfAllowed();
