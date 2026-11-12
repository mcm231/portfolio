// Code rows: the language choice, the snippet, the sample, and the tile.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

// A DOM stub that records enough to read a rendered block back.
function make(tag) {
    const node = {
        tag,
        className: '',
        children: [],
        attrs: {},
        text: '',
        style: {
            _v: {},
            cssText: '',
            setProperty(k, v) {
                this._v[k] = v;
            },
        },
        appendChild(c) {
            this.children.push(c);
            return c;
        },
        setAttribute(k, v) {
            this.attrs[k] = v;
        },
        classList: {
            add(name) {
                node.className += ` ${name}`;
            },
        },
        set textContent(v) {
            this.text = v;
        },
        get textContent() {
            return this.text || this.children.map(c => c.textContent).join('');
        },
    };
    return node;
}
globalThis.document = { createElement: make };

const { codeFor, buildCodeBlock, SAMPLES } = await import(`${ROOT}/public/js/code-tile.js`);
const { readSnippet } = await import(`${ROOT}/public/js/shared/row.js`);
const { languageOf, KNOWN_LANGUAGES } = await import(`${ROOT}/public/js/shared/taxonomy.js`);

const results = [];
const check = (label, got, want) =>
    results.push([label, JSON.stringify(got), JSON.stringify(want)]);

// Which language a row speaks.
check('its own field wins', languageOf({ language: 'Python', tags: ['go'] }), 'python');
check('a tag is the fallback', languageOf({ tags: ['art', 'rust'] }), 'rust');
check('neither gives javascript', languageOf({ tags: ['watercolor'] }), 'javascript');
check('an unknown field falls back', languageOf({ language: 'cobol', tags: ['go'] }), 'go');

// Which code a tile shows.
const own = codeFor({ language: 'python', snippet: 'print("hello")' });
check('a snippet wins', own.text, 'print("hello")');
check('a snippet is named', own.source, 'snippet');

const sample = codeFor({ language: 'python' });
check('no snippet gives a sample', sample.source, 'sample');
check('the sample matches the language', sample.text, SAMPLES.python);
check('an unknown language still draws', codeFor({ language: 'matlab' }).text.length > 0, true);

// Every named language must give a block, so no tile renders empty.
const missing = KNOWN_LANGUAGES.filter(name => !codeFor({ language: name }).text);
check('every language draws something', missing, []);

// The block itself.
const block = buildCodeBlock({ language: 'python', snippet: 'def go():\n    return 1' });
check('the block is marked a snippet', block.className.includes('is-snippet'), true);
check('the block hides from a reader', block.attrs['aria-hidden'], 'true');
check('the block holds two lines', block.children[0].children.length, 2);
check('the block names the language', block.children[1].textContent, 'python');

// The painter marks keywords, strings and comments.
function kinds(entry) {
    const made = buildCodeBlock(entry, { withLabel: false });
    return made.children[0].children.flatMap(line =>
        line.children.map(span => `${span.className.trim()}:${span.textContent}`)
    );
}

const painted = kinds({ language: 'javascript', snippet: 'const x = "hi"; // note' });
check('a keyword is marked', painted.includes('code-keyword:const'), true);
check('a string is marked', painted.includes('code-string:"hi"'), true);
check(
    'a comment is marked',
    painted.some(p => p.startsWith('code-comment:// note')),
    true
);

const hashed = kinds({ language: 'python', snippet: 'x = 1  # a note' });
check(
    'python uses a hash comment',
    hashed.some(p => p.startsWith('code-comment:# a note')),
    true
);

// A url inside a string must not read as a comment.
const url = kinds({ language: 'javascript', snippet: 'const u = "https://a.example";' });
check(
    'a url stays a string',
    url.some(p => p === 'code-string:"https://a.example"'),
    true
);
check(
    'a url makes no comment',
    url.some(p => p.startsWith('code-comment')),
    false
);

// The card clips. The script keeps every line whole, and caps the count only
// so one huge snippet cannot build thousands of nodes.
const long = buildCodeBlock(
    { language: 'javascript', snippet: 'x\n'.repeat(40) },
    { withLabel: false }
);
check('40 lines all draw', long.children[0].children.length, 40);

const huge = buildCodeBlock(
    { language: 'javascript', snippet: 'x\n'.repeat(400) },
    { withLabel: false }
);
check('the node guard holds at 60', huge.children[0].children.length, 60);

const wide = buildCodeBlock(
    { language: 'javascript', snippet: 'y'.repeat(200) },
    { withLabel: false }
);
check('a wide line stays whole', wide.children[0].children[0].textContent.length, 200);
check('no ellipsis is added', wide.children[0].children[0].textContent.includes('…'), false);

// Leading whitespace is the shape of the code, so every line keeps its own.
const indented = '    def go():\n        return 1\n';
check('the first line keeps its indent', readSnippet(indented), '    def go():\n        return 1');
check('a blank first line goes', readSnippet('\n\n  x = 1'), '  x = 1');
check('a blank last line goes', readSnippet('  x = 1\n\n\n'), '  x = 1');
check('a trailing space goes', readSnippet('  x = 1   '), '  x = 1');
check('a blank line inside stays', readSnippet('a\n\nb'), 'a\n\nb');
check('a tab survives', readSnippet('\tx = 1'), '\tx = 1');

// A blank line between two lines of code is a line of its own.
const spaced = buildCodeBlock(
    { language: 'python', snippet: 'a = 1\n\nb = 2' },
    { withLabel: false }
);
check('a blank line gets a row', spaced.children[0].children.length, 3);
check('the blank row is empty', spaced.children[0].children[1].children.length, 0);
check(
    'the rows read in order',
    spaced.children[0].children.map(l => l.textContent),
    ['a = 1', '', 'b = 2']
);

const deep = buildCodeBlock({ language: 'python', snippet: indented }, { withLabel: false });
check('the tile draws the indent', deep.children[0].children[0].textContent, '    def go():');

// A long line is cut on the right, so the indent on the left survives.
const longIndented = buildCodeBlock(
    { language: 'javascript', snippet: '        ' + 'y'.repeat(80) },
    { withLabel: false }
);
check(
    'a cut line keeps its indent',
    longIndented.children[0].children[0].textContent.startsWith('        '),
    true
);

let failed = 0;
for (const [label, got, want] of results) {
    const pass = got === want;
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} ${got}${pass ? '' : `  want ${want}`}`
    );
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
