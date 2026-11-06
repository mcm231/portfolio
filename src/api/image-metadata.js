import { readImageSize } from "./_image-size.js";
import { readTags, readMediums, normalizeTerm } from "../../public/js/taxonomy.js";
import { readImages } from "../../public/js/row.js";

const HEADER_BYTES = 262144;

// Raise this when the size reader changes. A row stamped with an older
// number gets read again, so a parser fix reaches the rows already stored.
const SIZE_VERSION = 2;

// Fills in any picture size the row does not already hold, by reading the
// object header once, and keeps the answer. A parser fix raises SIZE_VERSION,
// and every row is read again.
//
// `stored` is the row as the database holds it. The write builds on that, not
// on the resolved entry, so a field the read path adds can never be mistaken
// for a stored one.
async function backfillSizes(name, entry, stored, kv, r2) {
  const stale = entry.images.filter(image =>
    !image.width || !image.height || entry.sizeVersion !== SIZE_VERSION);
  if (stale.length === 0) return entry;

  const filled = await Promise.all(entry.images.map(async image => {
    if (image.width && image.height && entry.sizeVersion === SIZE_VERSION) return image;

    const object = await r2.get(image.key, { range: { offset: 0, length: HEADER_BYTES } });
    if (!object || typeof object.arrayBuffer !== "function") return image;

    try {
      const size = readImageSize(await object.arrayBuffer());
      return size ? { ...image, width: size.width, height: size.height } : image;
    } catch (error) {
      console.error(`Could not read the header of "${image.key}":`, error);
      return image;
    }
  }));

  const changed = filled.some((image, i) =>
    image.width !== entry.images[i].width || image.height !== entry.images[i].height);
  if (!changed && entry.sizeVersion === SIZE_VERSION) return entry;

  const updated = { ...entry, images: filled, sizeVersion: SIZE_VERSION };

  // A size fix also saves the promoted lists, so an old row ends up in the
  // current shape. The legacy singles go, and a stored `kind` stays, because
  // `stored` carries it and nothing here invents one.
  const { medium, filename, width, height, ...rest } = stored;
  const next = {
    ...rest,
    tags: entry.tags,
    mediums: entry.mediums,
    images: filled,
    sizeVersion: SIZE_VERSION
  };

  await kv.put(name, JSON.stringify(next));
  return updated;
}

// Three kinds of row live in this namespace.
//
//   image  a picture. "filename" names the object in the R2 bucket.
//   code   a program. It may carry a picture, a snippet, links and a
//          download. With no picture, the tile shows code.
//   panel  a piece with no picture and no code, such as a story. The tile
//          shows a color block.
//
// A row written by the upload page stores its kind. An older row has none,
// so the kind is worked out from the fields. Every row reports one, and no
// page ever has to guess.
//
// Returns { entry, stored }, or null when the row cannot be read. `entry` is
// what a reader sees. `stored` is the row the database holds, which the size
// backfill writes on.
async function resolveEntry(name, value, r2) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    console.error(`Skipping unparseable IMAGE_METADATA entry: "${name}"`);
    return null;
  }

  // An older row holds one `medium` string and one `filename`. A reader only
  // ever sees the lists: `mediums` and `images`.
  const shared = {
    id: name,
    ...parsed,
    tags: readTags(parsed),
    mediums: readMediums(parsed),
    images: readImages(parsed)
  };
  delete shared.medium;
  delete shared.filename;
  delete shared.width;
  delete shared.height;

  // A stored kind wins. Without one, a picture means image, and no picture
  // means panel. That keeps every row written before this field correct.
  const kind = parsed.kind || (shared.images.length > 0 ? "image" : "panel");

  if (shared.images.length === 0) return { entry: { ...shared, kind }, stored: parsed };

  // Drop a picture whose object is gone, rather than fail the whole row.
  const present = [];
  for (const image of shared.images) {
    if (await r2.head(image.key)) present.push(image);
    else console.error(`Entry "${name}": image "${image.key}" is not in R2`);
  }

  if (present.length === 0 && kind === "image") {
    console.error(`Skipping entry "${name}": no image survived`);
    return null;
  }

  return { entry: { ...shared, images: present, kind }, stored: parsed };
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

        const found = await resolveEntry(name, value, r2);
        return found ? backfillSizes(name, found.entry, found.stored, kv, r2) : null;
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

    const entry = await backfillSizes(
      imageId, found.entry, found.stored, context.env.IMAGE_METADATA, context.env.IMAGES);

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
