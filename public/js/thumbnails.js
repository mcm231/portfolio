// Makes the small copy for every picture that has none.
//
// The Worker cannot decode an image, so the work happens here: download the
// original, draw it small on a canvas, and post the result back. One pass is
// enough, because a row keeps its copy once it has one.

import { readImages } from './row.js';
import { makeThumbnail } from './thumbnail.js';

const startButton = document.getElementById('start');
const status = document.getElementById('status');
const log = document.getElementById('log');

let missing = [];

function write(line) {
    log.hidden = false;
    log.textContent += `${line}\n`;
}

function setStatus(text, kind) {
    status.textContent = text;
    status.className = `form-status${kind ? ` is-${kind}` : ''}`;
}

async function count() {
    const rows = await (await fetch('/api/image-metadata')).json();

    missing = rows.flatMap(row =>
        readImages(row)
            .filter(image => !image.thumb)
            .map(image => ({ id: row.id, key: image.key })));

    setStatus(missing.length === 0
        ? 'Every picture already has a small copy.'
        : `${missing.length} of ${rows.length} rows need one.`);

    startButton.disabled = missing.length === 0;
}

async function run() {
    startButton.disabled = true;
    let done = 0;
    let skipped = 0;
    let saved = 0;

    for (const { id, key } of missing) {
        setStatus(`Working on ${done + skipped + 1} of ${missing.length}…`);

        try {
            const response = await fetch(`/api/images?id=${encodeURIComponent(key)}`);
            const original = await response.blob();
            const copy = await makeThumbnail(original);

            if (!copy) {
                skipped++;
                write(`skipped  ${key}  (already small, or unreadable)`);
                continue;
            }

            const body = new FormData();
            body.set('id', id);
            body.set('key', key);
            body.set('thumb', copy, 'thumb.webp');

            const result = await fetch('/api/thumbnail', { method: 'POST', body });
            if (!result.ok) {
                skipped++;
                write(`failed   ${key}  ${(await result.json()).error ?? result.status}`);
                continue;
            }

            done++;
            saved += original.size - copy.size;
            write(`made     ${key}  ${Math.round(original.size / 1024)}KB`
                + ` -> ${Math.round(copy.size / 1024)}KB`);
        } catch (error) {
            skipped++;
            write(`failed   ${key}  ${error.message}`);
        }
    }

    setStatus(`${done} made, ${skipped} skipped.`
        + ` The wall now loads ${Math.round(saved / 1024 / 1024)}MB less.`, 'ok');
}

startButton.addEventListener('click', run);
count();
