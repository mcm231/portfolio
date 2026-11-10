// Id rules, shared by the upload form and the upload endpoint.
//
// The form imports this over HTTP. src/api/upload.js imports the same file at
// build time, so the two can never drift apart.

const MAX_TRIES = 200;

export function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

// "piece" becomes "piece-2". "piece-2" becomes "piece-3".
export function nextId(id) {
    const match = id.match(/^(.*?)-(\d+)$/);
    if (match) return `${match[1]}-${Number(match[2]) + 1}`;
    return `${id}-2`;
}

// Walks the numbers until one is free.
//
// Two versions, because the form holds the whole id set in memory while the
// Worker asks KV one key at a time. The loop is identical. Change both.
export function freeIdSync(wanted, isTaken) {
    let id = wanted;

    for (let i = 0; i < MAX_TRIES; i++) {
        if (!isTaken(id)) return id;
        id = nextId(id);
    }

    throw new Error(`No free id after ${MAX_TRIES} tries from "${wanted}".`);
}

export async function freeId(wanted, isTaken) {
    let id = wanted;

    for (let i = 0; i < MAX_TRIES; i++) {
        if (!(await isTaken(id))) return id;
        id = nextId(id);
    }

    throw new Error(`No free id after ${MAX_TRIES} tries from "${wanted}".`);
}
