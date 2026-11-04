// Private upload endpoint. functions/_middleware.js gates it with Cloudflare
// Access, so this handler assumes the caller is already allowed.
//
// It writes the image bytes to R2, then writes the metadata entry to KV. The
// KV key is the image id. The R2 object key is the entry's filename.
import { isValidTag } from './_constants.js';
// The browser loads the same file over HTTP, so the rules cannot drift.
import { slugify, freeId } from '../../public/js/id-rules.js';
import { readImageSize } from './_image-size.js';

const HEADER_BYTES = 262144;   // reaches past the Exif block of a phone photo
const SIZE_VERSION = 2;        // matches src/api/image-metadata.js

const MAX_BYTES = 25 * 1024 * 1024;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function extensionOf(filename, contentType) {
  const fromName = (filename.match(/\.([a-z0-9]+)$/i) || [])[1];
  if (fromName) return fromName.toLowerCase();

  const fromType = (contentType.match(/^image\/([a-z0-9+.-]+)$/i) || [])[1];
  return fromType ? fromType.replace('jpeg', 'jpg') : 'bin';
}

function splitList(value) {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Send the upload as multipart form data.' }, 400);
  }

  const file = form.get('file');
  const hasFile = Boolean(file) && typeof file !== 'string' && file.size > 0;

  if (hasFile) {
    if (file.size > MAX_BYTES) {
      return json({ error: `The file is over the ${MAX_BYTES / 1024 / 1024}MB limit.` }, 413);
    }
    if (!String(file.type).startsWith('image/')) {
      return json({ error: 'The file must be an image.' }, 415);
    }
  }

  const name = String(form.get('name') || '').trim();
  if (!name) return json({ error: 'Give the piece a name.' }, 400);

  const id = slugify(String(form.get('id') || '').trim() || name);
  if (!id) return json({ error: 'The id is empty after cleanup. Type one.' }, 400);

  const medium = String(form.get('medium') || '').trim();
  if (!medium) return json({ error: 'Name the medium.' }, 400);

  const tags = form.getAll('tags').map(tag => String(tag).trim()).filter(Boolean);
  if (tags.length === 0) return json({ error: 'Pick at least one tag.' }, 400);

  const unknownTag = tags.find(tag => !isValidTag(tag));
  if (unknownTag) return json({ error: `Unknown tag: "${unknownTag}"` }, 400);

  const dateCreated = String(form.get('dateCreated') || '').trim();
  if (!dateCreated) return json({ error: 'Give the date created.' }, 400);
  if (!DATE_PATTERN.test(dateCreated)) {
    return json({ error: 'Write the date as YYYY-MM-DD.' }, 400);
  }

  const overwrite = String(form.get('overwrite')) === 'true';
  const existingRaw = await env.IMAGE_METADATA.get(id);
  const clash = Boolean(existingRaw);

  // No file is only valid for an edit, where the entry keeps its own image.
  if (!hasFile && !(overwrite && clash)) {
    return json({ error: 'Choose an image file.' }, 400);
  }

  const taken = async key => Boolean(await env.IMAGE_METADATA.get(key));

  // A clash adds a number, or raises the number already there. Overwrite is
  // the one case that keeps the id and replaces the entry.
  let finalId = id;
  if (clash && !overwrite) {
    try {
      finalId = await freeId(id, taken);
    } catch (error) {
      console.error(error);
      return json({ error: 'Every numbered id is taken. Type a different one.' }, 409);
    }
  }

  // An edit with no new file keeps the object already in the bucket.
  const filename = hasFile
    ? `${finalId}.${extensionOf(file.name || '', file.type)}`
    : JSON.parse(existingRaw).filename;
  // The wall picks a tile shape from the pixel size, so a portrait never
  // lands in a wide band. Read it from the header, not from the browser.
  let size = null;
  if (hasFile) {
    size = readImageSize(await file.slice(0, HEADER_BYTES).arrayBuffer());
    if (!size) console.warn(`Could not read the size of "${filename}".`);
  } else {
    const previous = JSON.parse(existingRaw);
    if (previous.width && previous.height && previous.sizeVersion === SIZE_VERSION) {
      size = { width: previous.width, height: previous.height };
    }
  }

  const entry = {
    name,
    filename,
    description: String(form.get('description') || '').trim(),
    medium,
    tags,
    dateCreated,
    galleries: splitList(String(form.get('galleries') || '')),
    width: size ? size.width : null,
    height: size ? size.height : null,
    sizeVersion: size ? SIZE_VERSION : null
  };

  if (hasFile) {
    await env.IMAGES.put(filename, file.stream(), {
      httpMetadata: { contentType: file.type }
    });
  }

  try {
    await env.IMAGE_METADATA.put(finalId, JSON.stringify(entry));
  } catch (error) {
    // Drop the new object, so a failed write leaves nothing behind in R2. An
    // edit that reused the old object must keep it.
    if (hasFile) await env.IMAGES.delete(filename);
    console.error('KV write failed:', error);
    return json({ error: 'The image upload worked, but the metadata write failed.' }, 500);
  }

  const replaced = clash && overwrite;
  return json({ id: finalId, replaced, renamedFrom: finalId === id ? null : id, entry },
    replaced ? 200 : 201);
}

// Removes the metadata entry, then the image object. KV goes first, so a
// half-finished delete leaves an unused object rather than a broken entry.
export async function onRequestDelete(context) {
  const { request, env } = context;
  const id = new URL(request.url).searchParams.get('id');

  if (!id) return json({ error: "Missing the 'id' parameter." }, 400);

  const raw = await env.IMAGE_METADATA.get(id);
  if (!raw) return json({ error: `No entry with the id "${id}".` }, 404);

  let filename = null;
  try {
    filename = JSON.parse(raw).filename || null;
  } catch {
    console.error(`Unparseable entry "${id}". Deleting the key anyway.`);
  }

  await env.IMAGE_METADATA.delete(id);
  if (filename) await env.IMAGES.delete(filename);

  return json({ id, deleted: true, filename });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  if (context.request.method === 'DELETE') return onRequestDelete(context);
  return new Response('Use POST or DELETE.', { status: 405, headers: { Allow: 'POST, DELETE' } });
}
