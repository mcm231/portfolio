// One medium or one tag, as a link into the gallery search.
//
// A click opens the gallery with that term already in the filters, so a
// visitor goes from one piece to everything like it.
//
// The query key is the filter type name, and components/gallery-page.js reads
// the same key back. Keep the two in step: `medium` and `tag` are the names
// DATA_MODEL.md gives these fields.

const GALLERY = '/pages/gallery';

// The url of the gallery search, filtered by one term.
export function termUrl(kind, term) {
    return `${GALLERY}?${kind}=${encodeURIComponent(term)}`;
}

// A pill that carries one term. `kind` is `medium` or `tag`, and each one
// takes its own color, so the two never blur together.
export function buildTermPill(kind, term) {
    const pill = document.createElement('a');
    pill.className = `pill pill-${kind}`;
    pill.href = termUrl(kind, term);
    pill.textContent = term;

    // The color says which kind this is. A reader who cannot see the color
    // hears it instead.
    pill.setAttribute('aria-label', `Find every piece with the ${kind} ${term}`);

    return pill;
}
