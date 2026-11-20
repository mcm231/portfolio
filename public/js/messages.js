// The contact inbox. The Access gate protects every call this page makes.
//
// The table lists every message. A click opens one under the table, marks it
// read, and offers a reply. The reply leaves through the site address, so a
// visitor who answers it lands back in the inbox of the owner.
import { mountMenu } from './components/menu.js';
import { api, ApiError } from './api.js';

// The side drawer. One file holds the links, and marks this page.
mountMenu(document.getElementById('menu'));

const rows = document.getElementById('message-rows');
const count = document.getElementById('message-count');
const reader = document.getElementById('message-reader');
const status = document.getElementById('message-status');

let messages = [];
let canReply = false;
let openKey = null;

function setStatus(message, kind) {
    status.textContent = message;
    status.className = `form-status${kind ? ` is-${kind}` : ''}`;
}

function reasonFrom(error, fallback) {
    return error instanceof ApiError && error.status !== 0 ? error.message : fallback;
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function button(className, text, onClick) {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
}

// A short local stamp: the month, the day and the clock.
function when(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function subjectOf(message) {
    return message.subject || 'No subject';
}

/* ---------- The table ---------- */

function drawCount() {
    if (messages.length === 0) {
        count.textContent = 'No messages yet.';
        return;
    }

    const unread = messages.filter(message => !message.read).length;
    const all = messages.length === 1 ? '1 message' : `${messages.length} messages`;

    count.textContent = unread > 0 ? `${unread} unread of ${all}` : all;
}

function drawRows() {
    rows.replaceChildren(
        ...messages.map(message => {
            const row = element('tr', `inbox-row${message.read ? '' : ' is-unread'}`);
            if (message.key === openKey) row.classList.add('is-open');

            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            row.setAttribute(
                'aria-label',
                `${message.read ? 'Read' : 'Unread'}. ${message.name}. ${subjectOf(message)}`
            );

            // The dot says the state at a glance. The label above says the
            // same thing to a reader who hears the page.
            const state = element('td', 'inbox-state');
            state.setAttribute('aria-hidden', 'true');
            state.appendChild(element('span', 'inbox-dot'));

            row.append(
                state,
                element('td', 'inbox-from', message.name),
                element('td', 'inbox-subject', subjectOf(message)),
                element('td', 'inbox-when', when(message.sentAt))
            );

            row.addEventListener('click', () => open(message.key));
            row.addEventListener('keydown', event => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                open(message.key);
            });

            return row;
        })
    );
}

/* ---------- The reader ---------- */

function drawReplies(message) {
    const stored = Array.isArray(message.replies) ? message.replies : [];
    if (stored.length === 0) return null;

    const box = element('div', 'reader-replies');
    box.appendChild(
        element('h3', 'reader-sub', stored.length === 1 ? 'Your reply' : 'Your replies')
    );

    for (const reply of stored) {
        const one = element('article', 'reader-reply');
        one.append(
            element('p', 'reader-when', `You wrote ${when(reply.sentAt)}`),
            element('p', 'reader-body', reply.text)
        );
        box.appendChild(one);
    }

    return box;
}

function drawReplyForm(message) {
    if (!canReply) {
        return element(
            'p',
            'reader-note',
            'Email is not set up on this site, so this page cannot send a reply.'
        );
    }

    const form = element('form', 'reader-form');

    const label = element('label', 'form-label', 'Your reply');
    label.htmlFor = 'reply-text';

    const field = element('textarea', 'field reader-text');
    field.id = 'reply-text';
    field.rows = 6;
    field.placeholder = `Write to ${message.name}…`;

    const send = element('button', 'button', 'Send the reply');
    send.type = 'submit';

    const actions = element('div', 'reader-actions');
    actions.appendChild(send);
    form.append(label, field, actions);

    form.addEventListener('submit', async event => {
        event.preventDefault();

        const text = field.value.trim();
        if (!text) {
            setStatus('Write a reply first.', 'error');
            field.focus();
            return;
        }

        send.disabled = true;
        setStatus('Sending…');

        try {
            const answer = await api.replyToMessage(message.key, text);
            field.value = '';
            setStatus(`Success. The reply went to ${answer.message.email}.`, 'ok');
            replace(answer.message);
        } catch (error) {
            setStatus(reasonFrom(error, 'The reply did not send. Try again.'), 'error');
        } finally {
            send.disabled = false;
        }
    });

    return form;
}

function drawReader() {
    const message = messages.find(one => one.key === openKey);

    if (!message) {
        reader.hidden = true;
        reader.replaceChildren();
        return;
    }

    const head = element('div', 'reader-head');
    head.append(
        element('h2', 'reader-subject', subjectOf(message)),
        button('button button-quiet', 'Close', () => open(null))
    );

    const from = element('p', 'reader-from');
    const address = element('a', null, `${message.name} <${message.email}>`);
    address.href = `mailto:${message.email}`;
    from.appendChild(address);

    const controls = element('div', 'reader-actions');
    controls.append(
        button('button button-quiet', message.read ? 'Mark unread' : 'Mark read', () =>
            mark(message, !message.read)
        ),
        button('button button-danger', 'Delete', event => remove(message, event.currentTarget))
    );

    reader.replaceChildren(
        head,
        from,
        element('p', 'reader-when', when(message.sentAt)),
        element('p', 'reader-body', message.message)
    );

    const replies = drawReplies(message);
    if (replies) reader.appendChild(replies);

    reader.append(drawReplyForm(message), controls);
    reader.hidden = false;
}

function draw() {
    drawCount();
    drawRows();
    drawReader();
}

/* ---------- What the page does ---------- */

// Puts one message back in the list, in the place it already held.
function replace(message) {
    messages = messages.map(one => (one.key === message.key ? message : one));
    draw();
}

async function mark(message, read) {
    try {
        const answer = await api.markMessage(message.key, read);
        replace(answer.message);
    } catch (error) {
        setStatus(reasonFrom(error, 'The message did not change. Try again.'), 'error');
    }
}

// Opening a message marks it read. The reader keeps a control to put it back.
function open(key) {
    openKey = key;
    setStatus('');
    draw();

    const message = messages.find(one => one.key === key);
    if (message && !message.read) mark(message, true);
}

// The first press arms the control, the second deletes. The upload page
// guards a row the same way.
async function remove(message, control) {
    if (control.dataset.armed !== 'true') {
        control.dataset.armed = 'true';
        control.textContent = 'Press again to delete';
        setStatus(
            `This removes the message from ${message.name}. The step cannot be undone.`,
            'error'
        );
        return;
    }

    control.disabled = true;

    try {
        await api.deleteMessage(message.key);
        messages = messages.filter(one => one.key !== message.key);
        if (openKey === message.key) openKey = null;
        setStatus('The message is gone.');
        draw();
    } catch (error) {
        control.disabled = false;
        setStatus(reasonFrom(error, 'The message did not delete. Try again.'), 'error');
    }
}

async function load() {
    try {
        const answer = await api.messages();
        messages = Array.isArray(answer.messages) ? answer.messages : [];
        canReply = Boolean(answer.canReply);
        draw();
    } catch (error) {
        count.textContent = '';
        setStatus(reasonFrom(error, 'The inbox did not load. Reload the page.'), 'error');
    }
}

load();
