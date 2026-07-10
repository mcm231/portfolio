import { isValidTag } from "./_constants.js";

async function getAllEntries(kv) {
  const entries = [];
  let cursor;
  do {
    const list = await kv.list({ cursor });
    const batch = await Promise.all(
      list.keys.map(async ({ name }) => {
        const value = await kv.get(name);
        return value ? { id: name, ...JSON.parse(value) } : null;
      })
    );
    entries.push(...batch.filter(Boolean));
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  return entries;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const imageId = url.searchParams.get("id");
  const tag = url.searchParams.get("tag");

  if (imageId) {
    const value = await context.env.IMAGE_METADATA.get(imageId);
    if (!value) return new Response("Not found", { status: 404 });
    return new Response(value, {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (tag !== null && !isValidTag(tag)) {
    return new Response(JSON.stringify({ error: `Unknown tag: "${tag}"` }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const entries = await getAllEntries(context.env.IMAGE_METADATA);

  const results = tag
    ? entries.filter(e => Array.isArray(e.tags) && e.tags.includes(tag))
    : entries;

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" }
  });
}
