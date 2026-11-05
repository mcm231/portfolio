// The contact inbox. Reads /api/messages, which the Access gate protects.

const list = document.getElementById('message-list');
const count = document.getElementById('message-count');

function field(className, text) {
    const node = document.createElement('p');
    node.className = className;
    node.textContent = text;
    return node;
}

function card(message, onRemove) {
    const article = document.createElement('article');
    article.className = 'message-card';

    const header = document.createElement('div');
    header.className = 'message-head';

    const who = document.createElement('h2');
    who.className = 'message-from';
    who.textContent = message.subject || `A message from ${message.name}`;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button-quiet';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => onRemove(message, remove));

    header.append(who, remove);

    const reply = document.createElement('a');
    reply.className = 'message-reply';
    reply.href = `mailto:${encodeURIComponent(message.email)}`
        + `?subject=${encodeURIComponent('Re: ' + (message.subject || 'your message'))}`;
    reply.textContent = `${message.name} <${message.email}>`;

    const body = document.createElement('p');
    body.className = 'message-body';
    body.textContent = message.message;

    article.append(header, reply, field('message-date', message.sentAt), body);
    return article;
}

async function remove(message, button) {
    button.disabled = true;

    const response = await fetch(`/api/messages?key=${encodeURIComponent(message.key)}`,
        { method: 'DELETE' });

    if (!response.ok) {
        button.disabled = false;
        count.textContent = 'That message did not delete. Try again.';
        return;
    }

    load();
}

async function load() {
    try {
        const response = await fetch('/api/messages', { cache: 'no-store' });
        if (!response.ok) throw new Error(String(response.status));

        const { messages } = await response.json();
        count.textContent = messages.length === 1
            ? '1 message'
            : `${messages.length} messages`;

        list.replaceChildren(...messages.map(message => card(message, remove)));

        if (messages.length === 0) {
            list.append(field('message', 'Nothing yet.'));
        }
    } catch {
        count.textContent = 'The inbox did not load. Reload the page.';
    }
}

load();
