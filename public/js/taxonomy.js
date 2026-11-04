// Tags and mediums, shared by the pages and the Worker.
//
// There is no fixed list. A term is whatever you type, cleaned to one steady
// form, so "Oil Paint", "oil paint" and "OIL-PAINT" all become "oil-paint".
// The suggestions you see come from the terms already in the database.
//
// The browser loads this over HTTP. src/api/* imports the same file at build
// time, so the two can never drift apart.

export const MAX_TERM_LENGTH = 40;
export const MAX_TERMS = 24;

// One term, in its steady form. Returns '' when nothing usable is left.
export function normalizeTerm(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, MAX_TERM_LENGTH)
        .replace(/-+$/, '');
}

// A list of terms: cleaned, emptied of blanks, deduplicated, and capped.
export function normalizeList(values) {
    const seen = new Set();

    for (const value of Array.isArray(values) ? values : [values]) {
        const term = normalizeTerm(value);
        if (term) seen.add(term);
        if (seen.size >= MAX_TERMS) break;
    }

    return [...seen];
}

// The mediums of one row. An older row holds a single `medium` string, so it
// is promoted here rather than migrated in the database.
export function readMediums(entry) {
    if (!entry) return [];
    if (Array.isArray(entry.mediums)) return normalizeList(entry.mediums);
    return normalizeList(entry.medium ? [entry.medium] : []);
}

// The tags of one row.
export function readTags(entry) {
    return normalizeList(entry && entry.tags ? entry.tags : []);
}
