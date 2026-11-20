// The contact inbox. Private, and gated by src/gate.js.
//
// A message carries its own read flag and its own answers, so one delete
// takes everything about it away. DATA_MODEL.md holds the shape.
//
// Every route here answers in JSON, so a missing key reads as JSON too. The
// plain text notFound belongs to the routes that serve bytes.
import { messageRepository } from '../repositories/messageRepository.js';
import { canSend, sendMail } from './_mail.js';
import { badRequest, json, serverError } from './_reply.js';

const MAX_REPLY = 5000;

function gone() {
    return badRequest('No message with that key.', 404);
}

export async function listMessages(request, env) {
    // The page hides the reply form when the site cannot send, so it never
    // offers a button that must fail.
    return json({ messages: await messageRepository.list(env), canReply: canSend(env) });
}

async function readBody(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

// Marks one message read or unread. The body carries the key and the state.
export async function markMessage(request, env) {
    const body = await readBody(request);
    if (!body) return badRequest('Send the key and the read state as JSON.');

    const key = String(body.key || '');
    if (!messageRepository.isMessageKey(key)) return badRequest('Give the key of a message.');
    if (typeof body.read !== 'boolean') return badRequest('Say true or false for the read state.');

    const message = await messageRepository.setRead(env, key, body.read);
    if (!message) return gone();

    return json({ message });
}

// Answers one message. The mail goes to the visitor, and the answer is stored
// beside the message it answers.
//
// A reply that does not leave is never stored, so the page never shows an
// answer the visitor did not get.
export async function replyToMessage(request, env) {
    const body = await readBody(request);
    if (!body) return badRequest('Send the key and the reply as JSON.');

    const key = String(body.key || '');
    if (!messageRepository.isMessageKey(key)) return badRequest('Give the key of a message.');

    const text = String(body.reply || '')
        .trim()
        .slice(0, MAX_REPLY);
    if (!text) return badRequest('Write a reply.');

    if (!canSend(env)) return badRequest('Email is not set up on this site.', 503);

    const message = await messageRepository.get(env, key);
    if (!message) return gone();
    if (!message.email) return badRequest('That message carries no address to answer.');

    const subject = message.subject ? `Re: ${message.subject}` : 'Re: your message';
    const result = await sendMail(env, {
        to: message.email,
        // The visitor answers the site address, which routes onward. So a
        // thread stays on one address.
        replyTo: env.CONTACT_FROM,
        subject,
        text,
    });

    if (!result.sent) return serverError(result.reason);

    // An answered message is a read message.
    const stored = await messageRepository.addReply(env, key, {
        text,
        subject,
        sentAt: new Date().toISOString(),
    });
    if (!stored) return gone();

    return json({ message: await messageRepository.setRead(env, key, true) });
}

export async function deleteMessage(request, env) {
    const key = new URL(request.url).searchParams.get('key');

    if (!messageRepository.isMessageKey(key)) return badRequest('Give the key of a message.');

    await messageRepository.delete(env, key);
    return json({ key, deleted: true });
}
