// The line icons the site draws.
//
// Each one is a stroked path in a 16 by 16 box, with no fill. The stroke is
// currentColor, so an icon takes the ink of the control it sits in: red in a
// delete, white in a solid button.
//
// The site ships no icon library, and these are the only icons. Add one by
// adding a path here, so one file holds every shape.

const BOX = 16;

const PATHS = {
    // A trash can: the lid line, the handle, the body and two ribs.
    trash: 'M2.5 4.5h11M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4 4.5l.7 8.2a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.2M6.5 7.5v3M9.5 7.5v3',
    // A paper plane, with the fold line that gives it its wing.
    send: 'M14.5 1.5 7 9M14.5 1.5 10 14.5 7 9 1.5 6z',
    // An arrow back to the left, with the tail that curves away. The shape a
    // mail client uses for a reply.
    reply: 'M6.5 3.5 2 8l4.5 4.5M2 8h6.5a5.5 5.5 0 0 1 5.5 5.5v1',
};

// One icon, ready to sit inside a button. It carries no label, because the
// text beside it already names the action.
export function buildIcon(name) {
    const path = PATHS[name];
    if (!path) return null;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('viewBox', `0 0 ${BOX} ${BOX}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', path);
    shape.setAttribute('fill', 'none');
    shape.setAttribute('stroke', 'currentColor');
    shape.setAttribute('stroke-width', '1.4');
    shape.setAttribute('stroke-linecap', 'round');
    shape.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(shape);

    return svg;
}
