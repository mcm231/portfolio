// Builds the wall of work that surrounds the title card.
//
// Three kinds of tile sit in the wall:
//
//   image  a row with a picture. The photo fills the tile.
//   code   a program with no picture. The tile shows the row's own snippet,
//          or a short sample of its language. It is always square.
//   panel  a piece with no picture and no code. The tile shows a color.
//
// Every tile snaps to a square grid and spans a whole number of cells, so the
// edges line up and the gutter stays the same everywhere. Cells fill in order
// of distance from the center, which grows the wall outward from the title.

import { buildCodeBlock } from './code-tile.js';
import { readImages, previewKey } from './shared/row.js';
import { api } from './api.js';

const CELL = 118; // px, one grid unit
const GAP = 3; // px of page showing between two tiles
const FIELD_SCALE_X = 2.4; // field width, in screens
const FIELD_SCALE_Y = 2.8; // field height, in screens
const MAX_TILES = 900;
const OFFLINE_TILES = 90; // panels drawn when the API does not answer
const EDGE_OPACITY = 0.72; // opacity of the outermost tiles
const LARGE_FIRST = 3; // tiles nearest the card that prefer a big shape

// Tile footprints in cells, [cols, rows], grouped by the shape of the image
// they can hold. A photo only ever lands in a tile of its own orientation, so
// object-fit crops the edges rather than cutting the subject in half.
//
// Repeats act as weights, so the middle sizes are common. No shape goes past
// two to one, because a longer band reads as a strip rather than a picture.
const SHAPES = {
    landscape: [
        [2, 1],
        [2, 1],
        [3, 2],
        [3, 2],
        [3, 2],
        [4, 3],
        [4, 3],
        [4, 2],
    ],
    portrait: [
        [1, 2],
        [1, 2],
        [2, 3],
        [2, 3],
        [2, 3],
        [3, 4],
        [3, 4],
        [2, 4],
    ],
    square: [
        [1, 1],
        [1, 1],
        [1, 1],
        [2, 2],
        [2, 2],
        [2, 2],
        [3, 3],
    ],
    // A block of code needs room to read, so one cell is too small.
    code: [
        [2, 2],
        [2, 2],
        [2, 2],
        [3, 3],
    ],
};

// An image inside these ratios reads as square, so a square tile suits it.
const SQUARE_LOW = 0.9;
const SQUARE_HIGH = 1.1;

// Biggest first, for the few tiles closest to the card.
const LARGE_SHAPES = Object.fromEntries(
    Object.entries(SHAPES).map(([kind, list]) => [
        kind,
        [...list].sort((a, b) => b[0] * b[1] - a[0] * a[1]),
    ])
);

const KINDS = ['landscape', 'portrait', 'square'];

// The orientation of one database row.
//
// A photo takes the shape of its pixels. A panel takes the shape its row asks
// for, or a varied one. A row with no size at all reads as square, which
// crops either orientation the least.
function shapeKind(entry, random) {
    // A block of code reads best in a square, and never in one cell.
    if (tileKind(entry) === 'code') return 'code';

    if (tileKind(entry) === 'panel') {
        return KINDS.includes(entry.shape)
            ? entry.shape
            : KINDS[Math.floor(random() * KINDS.length)];
    }

    // The cover decides the shape, because the tile shows the cover.
    const cover = readImages(entry)[0];
    if (!cover || !cover.width || !cover.height) return 'square';

    const ratio = cover.width / cover.height;
    if (ratio <= SQUARE_LOW) return 'portrait';
    if (ratio >= SQUARE_HIGH) return 'landscape';
    return 'square';
}

// Panel colors live in css/tokens.css as --blank-1 .. --blank-N. A row may
// name one with a `panelColor` number. Otherwise the wall picks one.
const PANEL_COLORS = 8;

// What the wall should draw for one row.
//
// A picture always wins, whatever the kind, because a code project with a
// screenshot should show the screenshot.
function tileKind(entry) {
    if (!entry) return 'panel';
    if (readImages(entry).length > 0) return 'image';
    return entry.kind === 'code' ? 'code' : 'panel';
}

// Deterministic PRNG, so the wall stays put between renders.
function mulberry32(seed) {
    return function random() {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function createGrid(cols, rows) {
    const taken = new Uint8Array(cols * rows);

    return {
        cols,
        rows,
        isFree(col, row) {
            return (
                col >= 0 && row >= 0 && col < cols && row < rows && taken[row * cols + col] === 0
            );
        },
        fits(col, row, w, h) {
            if (col + w > cols || row + h > rows) return false;

            for (let r = row; r < row + h; r++)
                for (let c = col; c < col + w; c++) if (taken[r * cols + c]) return false;

            return true;
        },
        occupy(col, row, w, h) {
            for (let r = row; r < row + h; r++)
                for (let c = col; c < col + w; c++) taken[r * cols + c] = 1;
        },
    };
}

// Cell span the title card needs, rounded up so its content always fits.
function cardSpan(cardRect) {
    return {
        cols: Math.max(1, Math.ceil(cardRect.w / CELL)),
        rows: Math.max(1, Math.ceil(cardRect.h / CELL)),
    };
}

// Take the card's cells out of the grid and return its geometry. The card is
// laid out as one more tile, so it leaves a gap in the wall instead of
// covering it.
function placeCard(grid, span) {
    const col = (grid.cols - span.cols) / 2;
    const row = (grid.rows - span.rows) / 2;

    grid.occupy(col, row, span.cols, span.rows);

    return {
        x: (col - grid.cols / 2) * CELL,
        y: (row - grid.rows / 2) * CELL,
        w: span.cols * CELL - GAP,
        h: span.rows * CELL - GAP,
    };
}

// Cell indices, nearest the center first. That order decides the fill.
function cellsByDistance(cols, rows) {
    const cells = [];

    for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++)
            cells.push({
                col,
                row,
                distance: Math.hypot((col + 0.5 - cols / 2) * CELL, (row + 0.5 - rows / 2) * CELL),
            });

    return cells.sort((a, b) => a.distance - b.distance);
}

// Pick a shape of the right orientation that fits this cell. The first few
// tiles take the largest one, so a small collection still has a focal point.
//
// Returns null when no shape of that orientation fits. The caller then leaves
// the cell empty, because a wrong shape would crop the photo badly.
function chooseShape(grid, col, row, random, placed, kind) {
    if (placed < LARGE_FIRST) {
        for (const [w, h] of LARGE_SHAPES[kind]) {
            if (grid.fits(col, row, w, h)) return [w, h];
        }
    }

    const list = SHAPES[kind];
    const start = Math.floor(random() * list.length);

    for (let i = 0; i < list.length; i++) {
        const [w, h] = list[(start + i) % list.length];
        if (grid.fits(col, row, w, h)) return [w, h];
    }

    return null;
}

// `kinds` holds the orientation wanted by each tile, in placement order. A
// cell that cannot hold the next tile's orientation stays empty, and the tile
// waits for a cell that can.
function layOutTiles(grid, random, kinds) {
    const { cols, rows } = grid;
    const tiles = [];

    const place = (cell, w, h) => {
        grid.occupy(cell.col, cell.row, w, h);
        tiles.push({
            x: (cell.col - cols / 2) * CELL,
            y: (cell.row - rows / 2) * CELL,
            w: w * CELL - GAP,
            h: h * CELL - GAP,
            distance: Math.hypot(
                (cell.col + w / 2 - cols / 2) * CELL,
                (cell.row + h / 2 - rows / 2) * CELL
            ),
        });
    };

    const cells = cellsByDistance(cols, rows);

    for (const cell of cells) {
        if (tiles.length >= kinds.length) break;
        if (!grid.isFree(cell.col, cell.row)) continue;

        const shape = chooseShape(
            grid,
            cell.col,
            cell.row,
            random,
            tiles.length,
            kinds[tiles.length]
        );
        if (shape) place(cell, shape[0], shape[1]);
    }

    // A second sweep for anything the first pass could not seat. It uses the
    // smallest shape of the right orientation, so the crop stays honest.
    for (const cell of cells) {
        if (tiles.length >= kinds.length) break;
        if (!grid.isFree(cell.col, cell.row)) continue;

        const kind = kinds[tiles.length];
        const smallest = [...SHAPES[kind]].sort((a, b) => a[0] * a[1] - b[0] * b[1])[0];
        if (grid.fits(cell.col, cell.row, smallest[0], smallest[1])) {
            place(cell, smallest[0], smallest[1]);
        }
    }

    if (tiles.length < kinds.length) {
        console.warn(`The wall seated ${tiles.length} of ${kinds.length} tiles.`);
    }

    return tiles;
}

function buildTile(tile, entry, maxDistance, random) {
    const fade = Math.min(1, tile.distance / maxDistance);
    const opacity = 1 - fade * (1 - EDGE_OPACITY);

    const figure = document.createElement('figure');
    figure.className = 'tile';
    figure.style.cssText = [
        `--x:${Math.round(tile.x)}px`,
        `--y:${Math.round(tile.y)}px`,
        `--w:${tile.w}px`,
        `--h:${tile.h}px`,
        `--o:${opacity.toFixed(2)}`,
    ].join(';');

    const kind = tileKind(entry);

    if (kind === 'image') {
        // The small copy, when the row has one. The wall never needs more.
        const cover = readImages(entry)[0];
        const img = document.createElement('img');
        img.src = api.imageUrl(previewKey(cover));
        img.alt = entry.name || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.draggable = false;
        figure.appendChild(img);
        return figure;
    }

    if (kind === 'code') {
        figure.classList.add('is-code');
        figure.appendChild(buildCodeBlock(entry));
        if (entry.name) figure.setAttribute('aria-label', entry.name);
        return figure;
    }

    // A panel. The row may name a color, or the wall picks one.
    const named = Number(entry && entry.panelColor);
    const index =
        Number.isInteger(named) && named >= 1 && named <= PANEL_COLORS
            ? named
            : Math.floor(random() * PANEL_COLORS) + 1;

    figure.classList.add('is-panel');
    figure.style.setProperty('--panel', `var(--blank-${index})`);
    if (entry && entry.name) figure.setAttribute('aria-label', entry.name);

    return figure;
}

// Returns the rows, or null when the API did not answer. An empty array and
// a dead API mean different things, so they must not look alike.
async function loadEntries() {
    try {
        const entries = await api.rows();
        return Array.isArray(entries) ? entries.filter(Boolean) : null;
    } catch {
        return null;
    }
}

export async function renderMosaic({ container, card, seed = 20260102 }) {
    const random = mulberry32(seed);
    const cardBox = card.getBoundingClientRect();
    const span = cardSpan({ w: cardBox.width, h: cardBox.height });

    let cols = Math.ceil((window.innerWidth * FIELD_SCALE_X) / CELL);
    let rows = Math.ceil((window.innerHeight * FIELD_SCALE_Y) / CELL);

    // Match the parity of the card span, so the card lands dead center.
    if ((cols - span.cols) % 2 !== 0) cols += 1;
    if ((rows - span.rows) % 2 !== 0) rows += 1;

    const grid = createGrid(cols, rows);
    const cardRect = placeCard(grid, span);

    // One tile per row in the database. No image repeats. Blanks appear only
    // when the API is unreachable, because then the real count is unknown.
    const entries = await loadEntries();

    // No answer means the real count is unknown, so the wall fills with
    // panels. An empty database is different: it shows nothing.
    const shown =
        entries === null
            ? Array.from({ length: OFFLINE_TILES }, () => ({}))
            : entries.slice(0, MAX_TILES);

    const kinds = shown.map(entry => shapeKind(entry, random));

    const tiles = layOutTiles(grid, random, kinds);

    // Fade against the filled area, not the whole grid.
    const maxDistance = tiles.reduce((far, tile) => Math.max(far, tile.distance), 1);

    const fragment = document.createDocumentFragment();
    tiles.forEach((tile, index) => {
        fragment.appendChild(buildTile(tile, shown[index] ?? null, maxDistance, random));
    });

    container.replaceChildren(fragment);

    card.style.setProperty('--x', `${cardRect.x}px`);
    card.style.setProperty('--y', `${cardRect.y}px`);
    card.style.setProperty('--w', `${cardRect.w}px`);
    card.style.setProperty('--h', `${cardRect.h}px`);

    return {
        tiles: tiles.length,
        images: shown.filter(entry => tileKind(entry) === 'image').length,
        code: shown.filter(entry => tileKind(entry) === 'code').length,
        panels: shown.filter(entry => tileKind(entry) === 'panel').length,
        card: cardRect,
    };
}
