// Home page wiring: the pannable plane, the photo mosaic, and the side menu.
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

/* ---------- Menu ---------- */

function setMenuOpen(open) {
    menu.classList.toggle('is-open', open);
    menuPanel.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
}

menuToggle.addEventListener('click', () => setMenuOpen(menuPanel.hidden));

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMenuOpen(false);
});

document.addEventListener('pointerdown', event => {
    if (!menuPanel.hidden && !menu.contains(event.target)) setMenuOpen(false);
});

/* ---------- Mosaic ---------- */

applyPan({ x: 0, y: 0 });
renderMosaic({ container: mosaic, card });
