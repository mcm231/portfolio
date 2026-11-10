// Every contact message. They live in the IMAGES bucket under messages/, and
// that prefix string lives here.
//
// The prefix keeps a message away from the artwork, so the gallery never reads
// one and /api/images never serves one.
const MESSAGE_PREFIX = 'messages/';
const PAGE_SIZE = 200;

export const messageRepository = {
    isMessageKey(key) {
        return Boolean(key) && key.startsWith(MESSAGE_PREFIX);
    },

    // Writes one message and returns its key. The key carries the send time,
    // so the listing sorts without reading a single object.
    async put(env, record) {
        const token = crypto.randomUUID().slice(0, 8);
        const key = `${MESSAGE_PREFIX}${record.sentAt}-${token}.json`;

        await env.IMAGES.put(key, JSON.stringify(record, null, 2), {
            httpMetadata: { contentType: 'application/json' },
        });

        return key;
    },

    // Every message, newest first. An unreadable object is skipped, so one bad
    // write cannot hide the whole inbox.
    async list(env) {
        const messages = [];
        let cursor;

        do {
            const page = await env.IMAGES.list({
                prefix: MESSAGE_PREFIX,
                cursor,
                limit: PAGE_SIZE,
            });

            await Promise.all(
                page.objects.map(async ({ key }) => {
                    const object = await env.IMAGES.get(key);
                    if (!object) return;

                    try {
                        messages.push({ key, ...JSON.parse(await object.text()) });
                    } catch {
                        console.error(`Skipping unreadable message "${key}".`);
                    }
                })
            );

            cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);

        messages.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
        return messages;
    },

    async delete(env, key) {
        return env.IMAGES.delete(key);
    },
};
