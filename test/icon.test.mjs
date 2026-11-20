// The line icons, under a DOM stub. No browser.
//
// An icon takes the ink of the control around it, so the stroke must stay
// currentColor and the fill must stay away.
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function make(tag) {
    return {
        tag,
        children: [],
        attrs: {},
        setAttribute(name, value) {
            this.attrs[name] = value;
        },
        appendChild(child) {
            this.children.push(child);
            return child;
        },
    };
}

globalThis.document = { createElementNS: (_ns, tag) => make(tag) };

const { buildIcon } = await import(`${ROOT}/public/js/components/icon.js`);

const results = [];
const check = (label, got, want) =>
    results.push([label, JSON.stringify(got), JSON.stringify(want)]);

const trash = buildIcon('trash');
check('an icon is an svg', trash.tag, 'svg');
check('it carries the class', trash.attrs.class, 'icon');
check('it holds one path', trash.children.length, 1);
check('it is never read aloud', trash.attrs['aria-hidden'], 'true');
check('it never takes focus', trash.attrs.focusable, 'false');
check('it draws in a 16 box', trash.attrs.viewBox, '0 0 16 16');

const line = trash.children[0];
check('the stroke follows the control', line.attrs.stroke, 'currentColor');
check('the shape carries no fill', line.attrs.fill, 'none');
check('the corners are round', line.attrs['stroke-linejoin'], 'round');
check('the trash path has a lid', line.attrs.d.startsWith('M2.5 4.5h11'), true);

const send = buildIcon('send');
check('send is its own shape', send.children[0].attrs.d === line.attrs.d, false);
check('send draws a plane', send.children[0].attrs.d.includes('14.5 1.5'), true);

const chevron = buildIcon('chevron');
check('the chevron points down', chevron.children[0].attrs.d.endsWith('L12.5 6'), true);

// An unknown name must not make an empty box that looks like a bug.
check('an unknown icon is nothing', buildIcon('banana'), null);

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
