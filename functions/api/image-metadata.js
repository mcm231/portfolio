import { isValidTag } from "./_constants.js";

async function resolveEntry(name, value, r2) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    console.error(`Skipping unparseable IMAGE_METADATA entry: "${name}"`);
    return null;
  }

  if (!parsed.filename) {
    console.error(`Skipping IMAGE_METADATA entry "${name}": missing required "filename"`);
    return null;
  }

  if (!(await r2.head(parsed.filename))) {
    console.error(`Skipping IMAGE_METADATA entry "${name}": filename "${parsed.filename}" not found in R2`);
    return null;
  }

  return { id: name, ...parsed };
}

async function getAllEntries(kv, r2) {
  const entries = [];
  let cursor;
  do {
    const list = await kv.list({ cursor });
    const batch = await Promise.all(
      list.keys.map(async ({ name }) => {
        const value = await kv.get(name);
        return value ? resolveEntry(name, value, r2) : null;
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

    const entry = await resolveEntry(imageId, value, context.env.IMAGES);
    if (!entry) return new Response("Not found", { status: 404 });

    return new Response(JSON.stringify(entry), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (tag !== null && !isValidTag(tag)) {
    return new Response(JSON.stringify({ error: `Unknown tag: "${tag}"` }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const entries = await getAllEntries(context.env.IMAGE_METADATA, context.env.IMAGES);

  const results = tag
    ? entries.filter(e => Array.isArray(e.tags) && e.tags.includes(tag))
    : entries;

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" }
  });
}
