// The contact inbox. Private, and gated by src/gate.js.
//
// Messages live in the R2 bucket under messages/. This route lists them,
// newest first, and deletes one on request.

const MESSAGE_PREFIX = 'messages/';
const PAGE_SIZE = 200;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const messages = [];
  let cursor;

  do {
    const page = await env.IMAGES.list({ prefix: MESSAGE_PREFIX, cursor, limit: PAGE_SIZE });

    await Promise.all(page.objects.map(async ({ key }) => {
      const object = await env.IMAGES.get(key);
      if (!object) return;

      try {
        messages.push({ key, ...JSON.parse(await object.text()) });
      } catch {
        console.error(`Skipping unreadable message "${key}".`);
      }
    }));

    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  messages.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  return json({ messages });
}

export async function onRequestDelete(context) {
  const key = new URL(context.request.url).searchParams.get('key');

  if (!key || !key.startsWith(MESSAGE_PREFIX)) {
    return json({ error: "Give the key of a message." }, 400);
  }

  await context.env.IMAGES.delete(key);
  return json({ key, deleted: true });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'DELETE') return onRequestDelete(context);
  return new Response('Use GET or DELETE.', { status: 405, headers: { Allow: 'GET, DELETE' } });
}
