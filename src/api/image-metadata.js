import { readImageSize } from "./_image-size.js";
import { readTags, readMediums, normalizeTerm } from "../../public/js/taxonomy.js";

const HEADER_BYTES = 262144;

// Raise this when the size reader changes. A row stamped with an older
// number gets read again, so a parser fix reaches the rows already stored.
const SIZE_VERSION = 2;

// A row written before the size was stored gets it now, from the object
// header, and keeps it. One ranged read per row, once.
async function backfillSize(name, entry, kv, r2) {
  if (entry.kind === "panel") return entry;   // a panel has no bytes to read
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
  const { id, kind, ...stored } = filled;
  await kv.put(name, JSON.stringify(stored));
  return filled;
}

// Two kinds of row live in this namespace.
//
//   image  carries a "filename", and the bytes sit in the R2 bucket.
//   panel  carries no "filename". It stands for a piece with no picture, such
//          as a story or a program. The home page draws it as a color block.
//
// Every row reports its kind, so a page never has to guess.
async function resolveEntry(name, value, r2) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    console.error(`Skipping unparseable IMAGE_METADATA entry: "${name}"`);
    return null;
  }

  // An older row holds one `medium` string. Readers only ever see `mediums`.
  const shared = {
    id: name,
    ...parsed,
    tags: readTags(parsed),
    mediums: readMediums(parsed)
  };
  delete shared.medium;

  if (!parsed.filename) return { ...shared, kind: "panel" };

  if (!(await r2.head(parsed.filename))) {
    console.error(`Skipping IMAGE_METADATA entry "${name}": filename "${parsed.filename}" not found in R2`);
    return null;
  }

  return { ...shared, kind: "image" };
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
  const medium = url.searchParams.get("medium");

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

  // There is no fixed vocabulary, so any term is a valid query. One that
  // nobody has used simply matches nothing.
  const entries = await getAllEntries(context.env.IMAGE_METADATA, context.env.IMAGES);

  const wantedTag = tag === null ? null : normalizeTerm(tag);
  const wantedMedium = medium === null ? null : normalizeTerm(medium);

  const results = entries.filter(entry =>
    (!wantedTag || entry.tags.includes(wantedTag))
    && (!wantedMedium || entry.mediums.includes(wantedMedium)));

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" }
  });
}
