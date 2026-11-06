// Reading one database row, in the shapes a page expects.
//
// The browser loads this over HTTP. src/api/* imports the same file at build
// time, so a reader and a writer can never drift apart.

// The pictures of one row, always as a list.
//
// A row written before the list held one `filename`, with the size beside it.
// That shape is promoted here rather than migrated in the database.
export function readImages(entry) {
    if (!entry) return [];

    if (Array.isArray(entry.images)) {
        return entry.images
            .filter(image => image && image.key)
            .map(image => ({
                key: String(image.key),
                width: Number(image.width) || null,
                height: Number(image.height) || null
            }));
    }

    if (!entry.filename) return [];

    return [{
        key: String(entry.filename),
        width: Number(entry.width) || null,
        height: Number(entry.height) || null
    }];
}

// A code snippet, ready to show.
//
// Leading whitespace is the shape of the code, so every line keeps its own
// indent. Only the blank lines at the top and the bottom go, along with any
// trailing spaces at the end of a line.
export function readSnippet(text) {
    const lines = String(text ?? '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => line.replace(/\s+$/, ''));

    while (lines.length > 0 && lines[0] === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

    return lines.join('\n');
}

// The paragraphs of a description. A blank line starts a new one.
export function readParagraphs(text) {
    return String(text ?? '')
        .replace(/\r\n/g, '\n')
        .split(/\n\s*\n/)
        .map(block => block.trim())
        .filter(Boolean);
}
