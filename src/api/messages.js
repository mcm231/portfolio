// The contact inbox. Private, and gated by src/gate.js.
import { messageRepository } from '../repositories/messageRepository.js';
import { badRequest, json } from './_reply.js';

export async function listMessages(request, env) {
    return json({ messages: await messageRepository.list(env) });
}

export async function deleteMessage(request, env) {
    const key = new URL(request.url).searchParams.get('key');

    if (!messageRepository.isMessageKey(key)) return badRequest('Give the key of a message.');

    await messageRepository.delete(env, key);
    return json({ key, deleted: true });
}
