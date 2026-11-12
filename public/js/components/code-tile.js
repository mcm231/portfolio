// Draws a block of code, for a mosaic tile or a gallery card.
//
// A code project shows, in this order: its own image, then its own snippet,
// then a short sample of its language. The sample is decoration. It is never
// presented as the project's own code.

import { languageOf, DEFAULT_LANGUAGE } from '../shared/taxonomy.js';
import { readSnippet } from '../shared/row.js';

// The card decides what fits. CSS clips the block, both down and across, so
// the code is never cut in the middle by this file. The cap below is only a
// guard, so one huge snippet cannot build thousands of nodes.
const MAX_LINES = 60;

// A few lines of each language, for a project that gives no snippet.
const SAMPLES = {
    javascript: `export function freeId(wanted, isTaken) {
  let id = wanted;

  for (let i = 0; i < 200; i++) {
    if (!isTaken(id)) return id;
    id = nextId(id);
  }

  throw new Error('No free id.');
}`,
    typescript: `type Tile = { x: number; y: number };

export function place(tiles: Tile[], cell: Tile): Tile[] {
  if (tiles.some(t => overlaps(t, cell))) return tiles;
  return [...tiles, cell];
}`,
    python: `def process(items, limit=None):
    """Keep the items that pass, in order."""
    kept = []

    for item in items:
        if not item.ready:
            continue
        kept.append(item)

    return kept[:limit]`,
    java: `public final class Wall {
    private final List<Tile> tiles = new ArrayList<>();

    public void place(Tile tile) {
        if (tiles.stream().noneMatch(tile::overlaps)) {
            tiles.add(tile);
        }
    }
}`,
    c: `int free_id(const char *wanted, taken_fn taken) {
    char id[64];
    strncpy(id, wanted, sizeof id - 1);

    for (int i = 0; i < 200; i++) {
        if (!taken(id)) return 0;
        next_id(id, sizeof id);
    }
    return -1;
}`,
    cpp: `std::optional<Tile> Wall::place(const Cell& cell) {
    for (const auto& tile : tiles_) {
        if (tile.overlaps(cell)) return std::nullopt;
    }

    return tiles_.emplace_back(cell);
}`,
    csharp: `public IEnumerable<Tile> Place(Cell cell)
{
    if (tiles.Any(t => t.Overlaps(cell)))
        return tiles;

    tiles.Add(new Tile(cell));
    return tiles;
}`,
    go: `func FreeID(wanted string, taken func(string) bool) (string, error) {
	id := wanted

	for i := 0; i < 200; i++ {
		if !taken(id) {
			return id, nil
		}
		id = NextID(id)
	}
	return "", ErrNoFreeID
}`,
    rust: `pub fn free_id(wanted: &str, taken: impl Fn(&str) -> bool) -> Option<String> {
    let mut id = wanted.to_string();

    for _ in 0..200 {
        if !taken(&id) {
            return Some(id);
        }
        id = next_id(&id);
    }
    None
}`,
    ruby: `def free_id(wanted)
  id = wanted

  200.times do
    return id unless taken?(id)
    id = next_id(id)
  end

  raise 'No free id.'
end`,
    php: `function free_id(string $wanted, callable $taken): string {
    $id = $wanted;

    for ($i = 0; $i < 200; $i++) {
        if (!$taken($id)) return $id;
        $id = next_id($id);
    }
    throw new RuntimeException('No free id.');
}`,
    swift: `func freeId(_ wanted: String, taken: (String) -> Bool) -> String? {
    var id = wanted

    for _ in 0..<200 {
        if !taken(id) { return id }
        id = nextId(id)
    }
    return nil
}`,
    kotlin: `fun freeId(wanted: String, taken: (String) -> Boolean): String? {
    var id = wanted

    repeat(200) {
        if (!taken(id)) return id
        id = nextId(id)
    }
    return null
}`,
    sql: `select m.value as medium, count(*) as pieces
from rows r
join mediums m on m.row_id = r.id
where r.created_at >= date('now', '-1 year')
group by m.value
order by pieces desc;`,
    bash: `#!/usr/bin/env bash
set -euo pipefail

for file in public/js/*.js; do
  node --check "$file" || exit 1
done

echo "every file parses"`,
    html: `<figure class="tile">
  <img src="/api/images?id=piece.jpg" alt="A piece" loading="lazy">
  <figcaption class="tile-caption">
    <span class="tile-name">A piece</span>
  </figcaption>
</figure>`,
    css: `.tile {
  position: absolute;
  width: var(--w);
  height: var(--h);
  transform: translate(var(--x), var(--y));
  background: var(--color-surface);
}`,
};

// Words that read as structure, per family. A short list beats a parser here.
const KEYWORDS = {
    common: [
        'return',
        'if',
        'else',
        'for',
        'while',
        'break',
        'continue',
        'new',
        'class',
        'try',
        'catch',
        'throw',
        'import',
        'export',
        'from',
        'in',
        'of',
    ],
    javascript: ['const', 'let', 'var', 'function', 'async', 'await', 'typeof'],
    typescript: ['const', 'let', 'function', 'type', 'interface', 'async', 'await'],
    python: ['def', 'None', 'True', 'False', 'not', 'and', 'or', 'elif', 'self', 'raise'],
    java: ['public', 'private', 'final', 'static', 'void', 'this'],
    c: ['int', 'char', 'const', 'void', 'struct', 'sizeof'],
    cpp: ['auto', 'const', 'void', 'struct', 'namespace', 'template'],
    csharp: ['public', 'private', 'var', 'void', 'using'],
    go: ['func', 'var', 'nil', 'range', 'defer', 'package'],
    rust: ['fn', 'let', 'mut', 'pub', 'impl', 'match', 'Some', 'None'],
    ruby: ['def', 'end', 'do', 'unless', 'nil', 'raise'],
    php: ['function', 'echo', 'use', 'string'],
    swift: ['func', 'let', 'var', 'guard', 'nil'],
    kotlin: ['fun', 'val', 'var', 'repeat', 'null'],
    sql: ['select', 'from', 'where', 'join', 'group', 'order', 'by', 'on', 'as', 'count', 'desc'],
    bash: ['set', 'for', 'do', 'done', 'echo', 'exit'],
    css: [],
    html: [],
};

// Comment openers, per language.
const LINE_COMMENT = {
    python: '#',
    ruby: '#',
    bash: '#',
    sql: '--',
    r: '#',
    yaml: '#',
};

function keywordsFor(language) {
    return new Set([...KEYWORDS.common, ...(KEYWORDS[language] ?? [])]);
}

// Splits one line into spans: a comment, a string, a keyword, or plain text.
// Not a parser. It is enough to make a tile read as code.
function paintLine(line, language, words) {
    const opener = LINE_COMMENT[language] ?? '//';
    const commentAt = line.indexOf(opener);

    if (commentAt === 0 || (commentAt > 0 && !insideString(line, commentAt))) {
        return [
            ...paintCode(line.slice(0, commentAt), words),
            { kind: 'comment', text: line.slice(commentAt) },
        ];
    }

    return paintCode(line, words);
}

function insideString(line, index) {
    let quote = null;

    for (let i = 0; i < index; i++) {
        const char = line[i];
        if (quote) {
            if (char === quote) quote = null;
        } else if (char === '"' || char === "'" || char === '`') {
            quote = char;
        }
    }
    return Boolean(quote);
}

function paintCode(text, words) {
    const spans = [];
    // A string, a word, or anything else.
    const pattern = /("[^"]*"|'[^']*'|`[^`]*`)|([A-Za-z_][A-Za-z0-9_]*)|([^A-Za-z_"'`]+)/g;

    for (const [, string, word, other] of text.matchAll(pattern)) {
        if (string !== undefined) spans.push({ kind: 'string', text: string });
        else if (word !== undefined) {
            spans.push({ kind: words.has(word) ? 'keyword' : 'plain', text: word });
        } else spans.push({ kind: 'plain', text: other });
    }

    return spans;
}

// The code a row should show, and where it came from.
export function codeFor(entry) {
    const language = languageOf(entry);
    const own = readSnippet(entry && entry.snippet);

    return own
        ? { language, text: own, source: 'snippet' }
        : { language, text: SAMPLES[language] ?? SAMPLES[DEFAULT_LANGUAGE], source: 'sample' };
}

// Builds the block. `document` comes from the caller, so a test can stub it.
export function buildCodeBlock(entry, { withLabel = true } = {}) {
    const { language, text, source } = codeFor(entry);
    const words = keywordsFor(language);

    const block = document.createElement('div');
    block.className = `code-block-tile is-${source}`;
    block.setAttribute('aria-hidden', 'true');

    const pre = document.createElement('pre');
    pre.className = 'code-lines';

    for (const line of text.split('\n').slice(0, MAX_LINES)) {
        const row = document.createElement('span');
        row.className = 'code-line';

        for (const span of paintLine(line, language, words)) {
            const node = document.createElement('span');
            node.className = `code-${span.kind}`;
            node.textContent = span.text;
            row.appendChild(node);
        }

        pre.appendChild(row);
    }

    block.appendChild(pre);

    if (withLabel) {
        const label = document.createElement('span');
        label.className = 'code-language';
        label.textContent = language;
        block.appendChild(label);
    }

    return block;
}

export { SAMPLES };
