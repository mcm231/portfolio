// Builds the photo wall that surrounds the title card.
//
// Every tile snaps to a square grid and spans a whole number of cells, so the
// edges line up and the gutter stays the same everywhere. Cells fill in order
// of distance from the center, which grows the wall outward from the title.

const CELL = 118;          // px, one grid unit
const GAP = 3;             // px of page showing between two tiles
const FIELD_SCALE_X = 2.4; // field width, in screens
const FIELD_SCALE_Y = 2.8; // field height, in screens
const MAX_TILES = 900;
const EDGE_OPACITY = 0.72; // opacity of the outermost tiles

// Tile footprints in cells, [cols, rows]. Repeats act as weights: the 1x1 and
// 2x2 shapes are the most common, the 3x3 is rare.
const SHAPES = [
    [1, 1], [1, 1], [1, 1],
    [2, 2], [2, 2], [2, 2],
    [2, 1], [2, 1],
    [1, 2], [1, 2],
    [3, 2],
    [2, 3],
    [3, 3]
];

const BLANK_COLORS = [
    '#bcd2ea', '#a9c4e4', '#cdd9ec', '#9fb8dc',
    '#d6e2f2', '#b4cde8', '#c3d4ea', '#aec6e2'
];

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
            return col >= 0 && row >= 0 && col < cols && row < rows
                && taken[row * cols + col] === 0;
        },
        fits(col, row, w, h) {
            if (col + w > cols || row + h > rows) return false;

            for (let r = row; r < row + h; r++)
                for (let c = col; c < col + w; c++)
                    if (taken[r * cols + c]) return false;

            return true;
        },
        occupy(col, row, w, h) {
            for (let r = row; r < row + h; r++)
                for (let c = col; c < col + w; c++)
                    taken[r * cols + c] = 1;
        }
    };
}

// Cell span the title card needs, rounded up so its content always fits.
function cardSpan(cardRect) {
    return {
        cols: Math.max(1, Math.ceil(cardRect.w / CELL)),
        rows: Math.max(1, Math.ceil(cardRect.h / CELL))
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
        h: span.rows * CELL - GAP
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
                distance: Math.hypot((col + 0.5 - cols / 2) * CELL,
                                     (row + 0.5 - rows / 2) * CELL)
            });

    return cells.sort((a, b) => a.distance - b.distance);
}

// Pick a shape at random among those that fit this cell.
function chooseShape(grid, col, row, random) {
    const start = Math.floor(random() * SHAPES.length);

    for (let i = 0; i < SHAPES.length; i++) {
        const [w, h] = SHAPES[(start + i) % SHAPES.length];
        if (grid.fits(col, row, w, h)) return [w, h];
    }

    return [1, 1];
}

function layOutTiles(grid, random) {
    const { cols, rows } = grid;
    const tiles = [];

    for (const cell of cellsByDistance(cols, rows)) {
        if (tiles.length >= MAX_TILES) break;
        if (!grid.isFree(cell.col, cell.row)) continue;

        const [w, h] = chooseShape(grid, cell.col, cell.row, random);
        grid.occupy(cell.col, cell.row, w, h);

        tiles.push({
            x: (cell.col - cols / 2) * CELL,
            y: (cell.row - rows / 2) * CELL,
            w: w * CELL - GAP,
            h: h * CELL - GAP,
            distance: Math.hypot((cell.col + w / 2 - cols / 2) * CELL,
                                 (cell.row + h / 2 - rows / 2) * CELL)
        });
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
        `--o:${opacity.toFixed(2)}`
    ].join(';');

    if (entry) {
        const img = document.createElement('img');
        img.src = `/api/images?id=${encodeURIComponent(entry.filename)}`;
        img.alt = entry.name || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.draggable = false;
        figure.appendChild(img);
    } else {
        figure.classList.add('is-blank');
        figure.style.setProperty('--blank', BLANK_COLORS[Math.floor(random() * BLANK_COLORS.length)]);
    }

    return figure;
}

async function loadEntries() {
    try {
        const response = await fetch('/api/image-metadata');
        if (!response.ok) return [];

        const entries = await response.json();
        return Array.isArray(entries) ? entries.filter(e => e && e.filename) : [];
    } catch {
        // No API behind the page (plain static preview). Fall back to blanks.
        return [];
    }
}

export async function renderMosaic({ container, card, seed = 20260102 }) {
    const random = mulberry32(seed);
    const cardBox = card.getBoundingClientRect();
    const span = cardSpan({ w: cardBox.width, h: cardBox.height });

    let cols = Math.ceil(window.innerWidth * FIELD_SCALE_X / CELL);
    let rows = Math.ceil(window.innerHeight * FIELD_SCALE_Y / CELL);

    // Match the parity of the card span, so the card lands dead center.
    if ((cols - span.cols) % 2 !== 0) cols += 1;
    if ((rows - span.rows) % 2 !== 0) rows += 1;

    const grid = createGrid(cols, rows);
    const cardRect = placeCard(grid, span);
    const maxDistance = Math.hypot(cols * CELL, rows * CELL) / 2;

    const tiles = layOutTiles(grid, random);
    const entries = await loadEntries();

    const fragment = document.createDocumentFragment();
    tiles.forEach((tile, index) => {
        const entry = entries.length ? entries[index % entries.length] : null;
        fragment.appendChild(buildTile(tile, entry, maxDistance, random));
    });

    container.replaceChildren(fragment);

    card.style.setProperty('--x', `${cardRect.x}px`);
    card.style.setProperty('--y', `${cardRect.y}px`);
    card.style.setProperty('--w', `${cardRect.w}px`);
    card.style.setProperty('--h', `${cardRect.h}px`);

    return { tiles: tiles.length, images: entries.length, card: cardRect };
}
