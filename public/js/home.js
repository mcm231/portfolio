// Home page wiring: the pannable plane, the photo wall, and the side drawer.
import { createPan } from './components/pan.js';
import { renderMosaic } from './components/mosaic.js';
import { createLoadingScreen } from './components/loading-screen.js';
import { openDetail } from './components/detail-modal.js';
import { mountMenu } from './components/menu.js';

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

mountMenu(menu);

/* ---------- Photo wall ---------- */

// index.html carries the cover, so it paints with the document and nobody
// sees the title before it. The cover goes once every picture of the first
// screen answers, or after its own time limit. A failure must not leave the
// cover up, so the catch drops it.
const cover = createLoadingScreen({ screen: loadingScreen });

applyPan({ x: 0, y: 0, scale: 1 });

// A click on a tile opens the same detail view the gallery grid opens.
renderMosaic({ container: mosaic, card, onSelect: openDetail })
    .then(wall => {
        wall.covers.forEach(img => cover.track(img));
        return cover.seal();
    })
    .catch(() => cover.finish());
