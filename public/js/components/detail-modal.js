// The detail view of one row, over the page that opened it.
//
// The photo wall of the home page and the grid of the gallery page both open
// this, so one file holds the look and the behavior of a detail view. The
// component owns its own DOM: it adds the overlay to the body, and the
// backdrop, the Escape key, and the Close button each take it away.
//
// A code project reads as a document: the pictures, then the words. Every
// other row fills the view with the picture, and a handle slides the words
// out beside it. css/components.css holds both layouts.
import { buildCodeBlock } from './code-tile.js';
import { buildTermPill } from './term-pill.js';
import { readImages, readParagraphs, panelColor } from '../shared/row.js';
import { api } from '../api.js';

// One detail view stands at a time. A second open closes the first, so two
// overlays never stack.
let standing = null;

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function add(parent, child) {
    if (child) parent.appendChild(child);
}

function button(className, text, label) {
    const node = element('button', className, text);
    node.type = 'button';
    if (label) node.setAttribute('aria-label', label);
    return node;
}

// The rotating gallery at the top of a detail view. It shows the full
// picture, not the small copy, because this is where a visitor looks close.
function buildSlides(images, name) {
    const slides = element('div', 'slides');

    const picture = element('img', 'slides-image');
    picture.src = api.imageUrl(images[0].key);
    picture.alt = name || '';
    slides.appendChild(picture);

    if (images.length === 1) return slides;

    const dots = element('div', 'slides-dots');
    let shown = 0;

    function show(index) {
        shown = (index + images.length) % images.length;
        picture.src = api.imageUrl(images[shown].key);
        [...dots.children].forEach((dot, at) => dot.classList.toggle('is-on', at === shown));
    }

    images.forEach((image, index) => {
        const dot = button('slides-dot', null, `Picture ${index + 1}`);
        dot.addEventListener('click', () => show(index));
        dots.appendChild(dot);
    });

    const previous = button('slides-step is-prev', '‹', 'The picture before');
    previous.addEventListener('click', () => show(shown - 1));

    const next = button('slides-step is-next', '›', 'The next picture');
    next.addEventListener('click', () => show(shown + 1));

    slides.append(previous, next, dots);
    show(0);

    return slides;
}

// A row with no picture. The color stands in for the artwork.
function buildPanel(entry) {
    const panel = element('div', 'modal-panel');
    panel.style.setProperty('--panel', `var(--blank-${panelColor(entry)})`);
    panel.setAttribute('aria-hidden', 'true');
    return panel;
}

function buildName(entry) {
    return entry.name ? element('h2', 'detail-name', entry.name) : null;
}

// The date reads as plain text. A medium and a tag each get a pill from
// components/term-pill.js, one color for each, so the three never blur
// together. A click on a pill opens the gallery, filtered by that term.
function buildMeta(entry) {
    const mediums = entry.mediums || [];
    const tags = entry.tags || [];
    const parts = [];

    if (entry.dateCreated) parts.push(element('p', 'detail-date', entry.dateCreated));

    if (mediums.length > 0 || tags.length > 0) {
        const terms = element('ul', 'detail-terms');
        const carry = (kind, term) => {
            const item = element('li');
            item.appendChild(buildTermPill(kind, term));
            terms.appendChild(item);
        };

        mediums.forEach(term => carry('medium', term));
        tags.forEach(term => carry('tag', term));
        parts.push(terms);
    }

    return parts;
}

function buildParagraphs(text) {
    const paragraphs = readParagraphs(text);
    if (paragraphs.length === 0) return null;

    const box = element('div', 'detail-text');
    paragraphs.forEach(block => box.appendChild(element('p', null, block)));
    return box;
}

// True when the panel would hold nothing. The handle then stays away.
function hasWords(entry) {
    return (
        Boolean(entry.name) ||
        Boolean(entry.dateCreated) ||
        (entry.mediums || []).length > 0 ||
        (entry.tags || []).length > 0 ||
        readParagraphs(entry.description).length > 0
    );
}

function buildActions(entry, close) {
    const actions = element('div', 'modal-actions');

    if (entry.repoUrl) actions.appendChild(outLink('button', entry.repoUrl, 'Repo'));
    if (entry.liveUrl) actions.appendChild(outLink('button', entry.liveUrl, 'Live'));

    if (entry.download && entry.download.key) {
        const file = element('a', 'button button-quiet', `Download ${entry.download.name}`);
        file.href = api.fileUrl(entry.download.key);
        actions.appendChild(file);
    }

    const shut = button('button button-quiet', 'Close');
    shut.addEventListener('click', close);
    actions.appendChild(shut);

    return actions;
}

// A link off the site opens in a new tab, and tells that tab nothing about
// this one.
function outLink(className, href, text) {
    const anchor = element('a', className, text);
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return anchor;
}

// A code project reads as a document: the pictures, then the words.
function buildCodeDetail(entry, images, close) {
    const content = element('div', 'modal-content detail-document');

    if (images.length > 0) content.appendChild(buildSlides(images, entry.name));

    add(content, buildName(entry));
    buildMeta(entry).forEach(part => content.appendChild(part));
    add(content, buildParagraphs(entry.description));

    // The snippet stands in for the picture a code project may not carry.
    if (images.length === 0) {
        const code = element('div', 'detail-code');
        code.appendChild(buildCodeBlock(entry));
        content.appendChild(code);
    }

    content.appendChild(buildActions(entry, close));

    return content;
}

// Everything else: the picture fills the view, and a button slides the words
// out beside it.
function buildPieceDetail(entry, images, close) {
    const content = element('div', 'modal-content detail-stage');

    const stage = element('div', 'detail-stage-image');
    stage.appendChild(images.length > 0 ? buildSlides(images, entry.name) : buildPanel(entry));
    stage.appendChild(buildActions(entry, close));
    content.appendChild(stage);

    // A piece with nothing written about it needs no handle.
    if (!hasWords(entry)) return content;

    const words = element('aside', 'detail-panel');
    words.id = 'detail-panel';
    add(words, buildName(entry));
    buildMeta(entry).forEach(part => words.appendChild(part));
    add(words, buildParagraphs(entry.description));

    const handle = button('detail-handle', '‹', 'Show the description');
    handle.setAttribute('aria-expanded', 'false');
    handle.setAttribute('aria-controls', 'detail-panel');
    handle.addEventListener('click', () => {
        const open = content.classList.toggle('is-open');
        handle.textContent = open ? '›' : '‹';
        handle.setAttribute('aria-expanded', String(open));
        handle.setAttribute('aria-label', open ? 'Hide the description' : 'Show the description');
    });

    content.append(handle, words);

    return content;
}

// Opens the detail view of one row. Returns a handle with close(), or null
// when there is no row to show.
//
// `entry` is a row in the shape js/api.js returns. DATA_MODEL.md names the
// fields, and the kind decides the layout.
export function openDetail(entry) {
    if (standing) standing.close();
    if (!entry) return null;

    const overlay = element('div', 'modal-overlay');
    let gone = false;

    function close() {
        if (gone) return;
        gone = true;

        if (standing === handle) standing = null;
        document.removeEventListener('keydown', onKeyDown);
        overlay.remove();
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') close();
    }

    const images = readImages(entry);
    const content =
        entry.kind === 'code'
            ? buildCodeDetail(entry, images, close)
            : buildPieceDetail(entry, images, close);

    // A click on the backdrop closes the view. A click inside it must not.
    content.addEventListener('click', event => event.stopPropagation());
    overlay.addEventListener('click', close);

    overlay.appendChild(content);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeyDown);

    const handle = { close, element: overlay };
    standing = handle;

    return handle;
}
