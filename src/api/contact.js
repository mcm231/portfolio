// The contact form endpoint.
//
// Every message is stored, so nothing is ever lost. When the send_email
// binding exists, the message is also mailed on. The visitor sees the same
// answer either way.
import { messageRepository } from '../repositories/messageRepository.js';
import { badRequest, json, serverError } from './_reply.js';

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_SUBJECT = 160;
const MAX_BODY = 5000;

// A soft limit, held in the isolate. It slows a flood without a new binding.
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 3;
const recent = new Map();

// Good enough to catch a typo. The real test is whether a reply arrives.
function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function underLimit(ip, now) {
    const hits = (recent.get(ip) ?? []).filter(time => now - time < RATE_WINDOW_MS);
    hits.push(now);
    recent.set(ip, hits);

    // Drop the old keys, so the map cannot grow without end.
    if (recent.size > 500) {
        for (const [key, times] of recent) {
            if (times.every(time => now - time >= RATE_WINDOW_MS)) recent.delete(key);
        }
    }

    return hits.length <= RATE_LIMIT;
}

function escapeHtml(text) {
    return text.replace(
        /[<>&]/g,
        character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[character]
    );
}

// Mails the message on, when the site is set up to send. A failure here never
// loses the message, because it already sits in the bucket.
async function mailOn(env, record) {
    if (!env.EMAIL || !env.CONTACT_TO || !env.CONTACT_FROM) return false;

    const { name, email, subject, message } = record;

    try {
        await env.EMAIL.send({
            to: env.CONTACT_TO,
            from: { email: env.CONTACT_FROM, name: 'Portfolio contact form' },
            replyTo: { email, name },
            subject: subject || `A message from ${name}`,
            text: `${name} <${email}>\n\n${message}\n`,
            html: `<p><strong>${name}</strong> &lt;${email}&gt;</p><p>${escapeHtml(message).replace(
                /\n/g,
                '<br>'
            )}</p>`,
        });
        return true;
    } catch (error) {
        console.error('Could not mail the message on:', error);
        return false;
    }
}

export async function sendMessage(request, env) {
    let form;
    try {
        form = await request.formData();
    } catch {
        return badRequest('Send the message as form data.');
    }

    // A hidden field. A person leaves it empty, a crawler fills it in. The
    // answer looks normal, and nothing is stored.
    if (String(form.get('website') || '').trim()) return json({ sent: true });

    const name = String(form.get('name') || '')
        .trim()
        .slice(0, MAX_NAME);
    const email = String(form.get('email') || '')
        .trim()
        .slice(0, MAX_EMAIL);
    const subject = String(form.get('subject') || '')
        .trim()
        .slice(0, MAX_SUBJECT);
    const message = String(form.get('message') || '')
        .trim()
        .slice(0, MAX_BODY);

    if (!name) return badRequest('Give your name.');
    if (!looksLikeEmail(email)) return badRequest('Check the email address.');
    if (!message) return badRequest('Write a message.');

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    if (!underLimit(ip, now)) {
        return badRequest('That is a lot of messages. Try again in a minute.', 429);
    }

    const record = { name, email, subject, message, sentAt: new Date(now).toISOString(), ip };

    try {
        await messageRepository.put(env, record);
    } catch (error) {
        console.error('Could not store the message:', error);
        return serverError('The message did not go through. Try again.');
    }

    return json({ sent: true, mailed: await mailOn(env, record) }, 201);
}
