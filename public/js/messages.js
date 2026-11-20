// The contact inbox. The Access gate protects every call this page makes.
//
// The table lists every message. A click opens one under the table, marks it
// read, and offers a reply. The reply leaves through the site address, so a
// visitor who answers it lands back in the inbox of the owner.
import { mountMenu } from './components/menu.js';
import { buildCloseButton } from './components/close-button.js';
import { buildIcon } from './components/icon.js';
import { api, ApiError } from './api.js';

// The side drawer. One file holds the links, and marks this page.
mountMenu(document.getElementById('menu'));

const rows = document.getElementById('message-rows');
const count = document.getElementById('message-count');
const status = document.getElementById('message-status');

let messages = [];
let canReply = false;
let openKey = null;
let replyOpen = false;

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

// The icon goes before the word, so the eye reads the shape first.
function iconButton(className, icon, text, onClick) {
    const node = button(className, text, onClick);
    node.prepend(buildIcon(icon));
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

function buildRow(message) {
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

    // The row is a switch. The open one closes, and any other one
    // takes its place.
    const toggle = () => open(message.key === openKey ? null : message.key);

    row.addEventListener('click', toggle);
    row.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
    });

    return row;
}

// The table carries the reader. It opens as a row right under the message it
// shows, so its top meets the bottom of that row.
function drawRows() {
    const list = [];

    for (const message of messages) {
        list.push(buildRow(message));
        if (message.key === openKey) list.push(buildReaderRow(message));
    }

    rows.replaceChildren(...list);
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

// The box that holds the reply, closed until the Reply button opens it.
// css/messages.css slides it, so the page sets a class and nothing else.
//
// The box carries no button. The one in the row below sends it, and that row
// moves down as the box grows.
function drawReplyBox(message) {
    const box = element('div', 'reader-slide');
    const inner = element('div', 'reader-slide-inner');
    box.appendChild(inner);

    const label = element('label', 'form-label', 'Your reply');
    label.htmlFor = 'reply-text';

    const field = element('textarea', 'field reader-text');
    field.id = 'reply-text';
    field.rows = 6;
    field.placeholder = `Write to ${message.name}…`;

    inner.append(label, field);

    return box;
}

// Swaps what a button shows, without building a new one.
function setFace(node, icon, text) {
    node.replaceChildren(buildIcon(icon), document.createTextNode(text));
}

// One table row that holds the whole message, under the row it belongs to.
function buildReaderRow(message) {
    const head = element('div', 'reader-head');
    head.append(element('h2', 'reader-subject', subjectOf(message)));

    const from = element('p', 'reader-from');
    const address = element('a', null, `${message.name} <${message.email}>`);
    address.href = `mailto:${message.email}`;
    from.appendChild(address);

    // The two small controls of the message, at the top right. The cross is
    // the last thing in the row, as STYLE_GUIDE.md asks.
    const tools = element('div', 'reader-tools');
    tools.append(
        button('button button-quiet button-small', message.read ? 'Mark unread' : 'Mark read', () =>
            mark(message, !message.read)
        ),
        buildCloseButton(() => open(null), 'Close the message')
    );

    const box = drawReplyBox(message);
    box.classList.toggle('is-open', replyOpen);

    // One button carries the whole answer. Closed it reads Reply, and the
    // first press opens the box above it. Open it reads Send.
    //
    // It turns the class on the box that already stands in the page. A redraw
    // would make a new box, and a new box cannot slide.
    const answer = iconButton('button', replyOpen ? 'send' : 'reply', replyOpen ? 'Send' : 'Reply');

    answer.addEventListener('click', async () => {
        const field = box.querySelector('.reader-text');

        if (!replyOpen) {
            replyOpen = true;
            box.classList.add('is-open');
            setFace(answer, 'send', 'Send');
            field.focus();
            return;
        }

        const text = field.value.trim();
        if (!text) {
            setStatus('Write a reply first.', 'error');
            field.focus();
            return;
        }

        answer.disabled = true;
        setStatus('Sending…');

        try {
            const sent = await api.replyToMessage(message.key, text);
            field.value = '';
            setStatus(`Success. The reply went to ${sent.message.email}.`, 'ok');
            // The box closes on a sent reply, and the new answer shows above.
            replyOpen = false;
            replace(sent.message);
        } catch (error) {
            setStatus(reasonFrom(error, 'The reply did not send. Try again.'), 'error');
        } finally {
            answer.disabled = false;
        }
    });

    // One row carries the two acts on this message: the answer on the left,
    // and the step that cannot be undone on the right.
    const actions = element('div', 'reader-actions');
    actions.append(
        canReply
            ? answer
            : element(
                  'p',
                  'reader-note',
                  'Email is not set up on this site, so this page cannot send a reply.'
              ),
        iconButton('button button-small button-danger', 'trash', 'Delete', event =>
            remove(message, event.currentTarget)
        )
    );

    const reader = element('div', 'reader');
    reader.append(
        tools,
        head,
        from,
        element('p', 'reader-when', when(message.sentAt)),
        element('p', 'reader-body', message.message)
    );

    const replies = drawReplies(message);
    if (replies) reader.appendChild(replies);

    if (canReply) reader.appendChild(box);
    reader.appendChild(actions);

    // The cell spans the whole table, so the reader runs the width of the
    // message above it.
    const cell = element('td', 'reader-cell');
    cell.colSpan = 4;
    cell.appendChild(reader);

    const row = element('tr', 'reader-row');
    row.appendChild(cell);

    return row;
}

function draw() {
    drawCount();
    drawRows();
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
    replyOpen = false;
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
