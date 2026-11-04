import { isValidTag } from "./_constants.js";
import { readImageSize } from "./_image-size.js";

const HEADER_BYTES = 262144;

// Raise this when the size reader changes. A row stamped with an older
// number gets read again, so a parser fix reaches the rows already stored.
const SIZE_VERSION = 2;

// A row written before the size was stored gets it now, from the object
// header, and keeps it. One ranged read per row, once.
async function backfillSize(name, entry, kv, r2) {
  if (entry.width && entry.height && entry.sizeVersion === SIZE_VERSION) return entry;

  const object = await r2.get(entry.filename, { range: { offset: 0, length: HEADER_BYTES } });
  if (!object || typeof object.arrayBuffer !== 'function') return entry;

  let size = null;
  try {
    size = readImageSize(await object.arrayBuffer());
  } catch (error) {
    console.error(`Could not read the header of "${entry.filename}":`, error);
  }
  if (!size) return entry;

  const filled = { ...entry, width: size.width, height: size.height, sizeVersion: SIZE_VERSION };
  const { id, ...stored } = filled;
  await kv.put(name, JSON.stringify(stored));
  return filled;
}

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
        if (!value) return null;

        const entry = await resolveEntry(name, value, r2);
        return entry ? backfillSize(name, entry, kv, r2) : null;
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

    const found = await resolveEntry(imageId, value, context.env.IMAGES);
    if (!found) return new Response("Not found", { status: 404 });

    const entry = await backfillSize(imageId, found, context.env.IMAGE_METADATA, context.env.IMAGES);

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
