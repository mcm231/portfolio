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
const BLANK_TILES = 90;    // only when the image API is unreachable
const EDGE_OPACITY = 0.72; // opacity of the outermost tiles
const LARGE_FIRST = 3;     // tiles nearest the card that prefer a big shape

// Tile footprints in cells, [cols, rows], grouped by the shape of the image
// they can hold. A photo only ever lands in a tile of its own orientation, so
// object-fit crops the edges rather than cutting the subject in half.
//
// Repeats act as weights, so the middle sizes are common.
const SHAPES = {
    landscape: [
        [2, 1], [2, 1],
        [3, 2], [3, 2], [3, 2],
        [4, 3], [4, 3],
        [3, 1],
        [4, 2]
    ],
    portrait: [
        [1, 2], [1, 2],
        [2, 3], [2, 3], [2, 3],
        [3, 4], [3, 4],
        [1, 3],
        [2, 4]
    ],
    square: [
        [1, 1], [1, 1], [1, 1],
        [2, 2], [2, 2], [2, 2],
        [3, 3]
    ]
};

// An image inside these ratios reads as square, so a square tile suits it.
const SQUARE_LOW = 0.9;
const SQUARE_HIGH = 1.1;

// Biggest first, for the few tiles closest to the card.
const LARGE_SHAPES = Object.fromEntries(
    Object.entries(SHAPES).map(([kind, list]) =>
        [kind, [...list].sort((a, b) => b[0] * b[1] - a[0] * a[1])])
);

// The orientation of one database row. A row with no size reads as square,
// which crops either orientation the least.
function shapeKind(entry) {
    if (!entry || !entry.width || !entry.height) return 'square';

    const ratio = entry.width / entry.height;
    if (ratio <= SQUARE_LOW) return 'portrait';
    if (ratio >= SQUARE_HIGH) return 'landscape';
    return 'square';
}

// Placeholder tile colors live in css/styles.css as --blank-1 .. --blank-N.
const BLANK_COUNT = 8;

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
            distance: Math.hypot((cell.col + w / 2 - cols / 2) * CELL,
                                 (cell.row + h / 2 - rows / 2) * CELL)
        });
    };

    const cells = cellsByDistance(cols, rows);

    for (const cell of cells) {
        if (tiles.length >= kinds.length) break;
        if (!grid.isFree(cell.col, cell.row)) continue;

        const shape = chooseShape(grid, cell.col, cell.row, random,
            tiles.length, kinds[tiles.length]);
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
        figure.style.setProperty('--blank', `var(--blank-${Math.floor(random() * BLANK_COUNT) + 1})`);
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

    // One tile per row in the database. No image repeats. Blanks appear only
    // when the API is unreachable, because then the real count is unknown.
    const entries = await loadEntries();
    const shown = entries.slice(0, MAX_TILES);

    // One orientation per tile. A blank wall has no images, so it uses the
    // full shape mix instead.
    const kinds = shown.length
        ? shown.map(shapeKind)
        : Array.from({ length: BLANK_TILES },
            () => ['landscape', 'portrait', 'square'][Math.floor(random() * 3)]);

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

    return { tiles: tiles.length, images: shown.length, card: cardRect };
}
