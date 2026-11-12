// The side drawer, on every page that carries one.
//
// One file holds the link list, so a new page joins the menu in one place.
// The link of the page a visitor stands on reads as current.
//
// The nav, the button and the empty panel sit in the markup of each page, so
// the button paints with the document. This file fills the panel, builds the
// scrim, and wires the behavior. A page hands over its own nav element, and
// never an id.
import { api } from '../api.js';

// Every page the menu names, in the order it shows them. A private link waits
// for /api/session, because src/gate.js guards the route behind it.
export const MENU_LINKS = [
    { href: '/', label: 'Home' },
    { href: '/pages/gallery', label: 'Gallery Search' },
    { href: '/pages/about', label: 'About' },
    { href: '/pages/contact', label: 'Contact' },
    { href: '/pages/upload', label: 'Upload', isPrivate: true },
    { href: '/pages/edit', label: 'Edit', isPrivate: true },
    { href: '/pages/messages', label: 'Messages', isPrivate: true },
    { href: '/pages/thumbnails', label: 'Small copies', isPrivate: true },
];

// The link form of a path. The asset router answers one page at /pages/about,
// at /pages/about/ and at /pages/about.html, so all three forms land on one
// link. A query string never names the page.
export function linkOf(path) {
    const clean = String(path || '')
        .split('?')[0]
        .split('#')[0]
        .replace(/\.html$/, '')
        .replace(/\/+$/, '');

    return clean === '' ? '/' : clean;
}

// Fills the drawer of one page and wires it. Returns a handle with open(),
// close() and toggle(), for a page that drives the drawer itself.
//
//   menu     the <nav class="menu"> of that page
//   current  the path the page stands for, default the path in the address
//            bar. The link of that path carries aria-current.
export function mountMenu(menu, { current = location.pathname } = {}) {
    if (!menu) return null;

    const toggle = menu.querySelector('.menu-toggle');
    const panel = menu.querySelector('.menu-panel');
    if (!toggle || !panel) return null;

    const here = linkOf(current);
    const privateItems = [];

    const list = document.createElement('ul');

    for (const entry of MENU_LINKS) {
        const item = document.createElement('li');

        const anchor = document.createElement('a');
        anchor.href = entry.href;
        anchor.textContent = entry.label;

        // The mark carries the state, and css/base.css paints from it. A
        // visitor on this page needs no link back to it.
        if (entry.href === here) anchor.setAttribute('aria-current', 'page');

        if (entry.isPrivate) {
            item.className = 'menu-private';
            item.hidden = true;
            privateItems.push(item);
        }

        item.appendChild(anchor);
        list.appendChild(item);
    }

    panel.replaceChildren(list);

    // The scrim never shows at rest, so it needs no place in the markup.
    const scrim = document.createElement('div');
    scrim.id = 'menu-scrim';
    document.body.appendChild(scrim);

    function isOpen() {
        return menu.classList.contains('is-open');
    }

    function setOpen(open) {
        if (open === isOpen()) return;

        menu.classList.toggle('is-open', open);
        scrim.classList.toggle('is-visible', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');

        const firstLink = panel.querySelector('a');
        if (open && firstLink) firstLink.focus();
        else if (!open) toggle.focus();
    }

    toggle.addEventListener('click', () => setOpen(!isOpen()));
    scrim.addEventListener('click', () => setOpen(false));

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') setOpen(false);
    });

    // These links are a courtesy, not a lock. src/gate.js blocks the routes,
    // so a visitor who unhides an item still lands on the Access login page.
    api.session()
        .then(({ allowed }) => {
            privateItems.forEach(item => {
                item.hidden = !allowed;
            });
        })
        .catch(() => {
            // Leave the links hidden.
        });

    return {
        element: menu,
        open: () => setOpen(true),
        close: () => setOpen(false),
        toggle: () => setOpen(!isOpen()),
    };
}
