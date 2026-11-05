// The contact form. It posts to /api/contact, which stores the message and
// mails it on when the site is set up to send.
//
// The two outside links live here, in one place. Leave a url empty and that
// card stays hidden, so the page never shows a dead link.

const LINKS = {
    instagram: { handle: '@_maymala', url: 'https://instagram.com/_maymala' },
    commissions: { url: '' }
};

function showLink(id, url, fill) {
    const card = document.getElementById(id);
    if (!url) return;

    card.href = url;
    card.hidden = false;
    if (fill) fill(card);
}

showLink('instagram-link', LINKS.instagram.url, () => {
    document.getElementById('instagram-handle').textContent = LINKS.instagram.handle;
});

showLink('commissions-link', LINKS.commissions.url);

const form = document.getElementById('contact-form');
const submitButton = document.getElementById('contact-submit');
const status = document.getElementById('contact-status');

const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const messageInput = document.getElementById('message');

function setStatus(text, kind) {
    status.textContent = text;
    status.className = `form-status${kind ? ` is-${kind}` : ''}`;
}

function firstProblem() {
    if (!nameInput.value.trim()) return [nameInput, 'Give your name.'];
    if (!emailInput.value.trim()) return [emailInput, 'Give your email address.'];
    if (!emailInput.checkValidity()) return [emailInput, 'Check the email address.'];
    if (!messageInput.value.trim()) return [messageInput, 'Write a message.'];
    return null;
}

function markInvalid(element) {
    document.querySelectorAll('.is-invalid').forEach(node => node.classList.remove('is-invalid'));
    element.classList.add('is-invalid');
    element.focus();
}

form.addEventListener('input', event => event.target.classList.remove('is-invalid'));

form.addEventListener('submit', async event => {
    event.preventDefault();

    const problem = firstProblem();
    if (problem) {
        markInvalid(problem[0]);
        setStatus(problem[1], 'error');
        return;
    }

    submitButton.disabled = true;
    setStatus('Sending…');

    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            body: new FormData(form)
        });
        const result = await response.json();

        if (!response.ok) {
            setStatus(result.error || 'The message did not go through. Try again.', 'error');
            return;
        }

        form.reset();
        setStatus('Thank you. Your message reached me, and I will answer soon.', 'ok');
    } catch {
        setStatus('The message did not go through. Check the network and try again.', 'error');
    } finally {
        submitButton.disabled = false;
    }
});
