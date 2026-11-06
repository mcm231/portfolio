// Private upload endpoint. functions/_middleware.js gates it with Cloudflare
// Access, so this handler assumes the caller is already allowed.
//
// It writes the image bytes to R2, then writes the metadata entry to KV. The
// KV key is the image id. The R2 object key is the entry's filename.
import { normalizeList } from '../../public/js/taxonomy.js';
import { readImages, readSnippet } from '../../public/js/row.js';
// The browser loads the same file over HTTP, so the rules cannot drift.
import { slugify, freeId } from '../../public/js/id-rules.js';
import { readImageSize } from './_image-size.js';

const HEADER_BYTES = 262144;   // reaches past the Exif block of a phone photo
const SIZE_VERSION = 2;        // matches src/api/image-metadata.js

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_SNIPPET = 2000;
const FILE_PREFIX = 'files/';
const KINDS = new Set(['image', 'code']);
const MAX_IMAGES = 12;
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

// A link the browser can open. Anything else is refused, so a row cannot
// carry a javascript: url into a page.
function cleanUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
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

  // The kind is stored, not guessed. An image row needs a picture. A code
  // row does not, because its tile can show code instead.
  const kind = KINDS.has(String(form.get('kind'))) ? String(form.get('kind')) : 'image';

  // A row may carry several pictures. The first one is the cover.
  const picked = form.getAll('file')
    .filter(item => item && typeof item !== 'string' && item.size > 0)
    .slice(0, MAX_IMAGES);
  const hasFile = picked.length > 0;

  for (const item of picked) {
    if (item.size > MAX_BYTES) {
      return json({ error: `"${item.name}" is over the ${MAX_BYTES / 1024 / 1024}MB limit.` }, 413);
    }
    if (!String(item.type).startsWith('image/')) {
      return json({ error: `"${item.name}" is not an image.` }, 415);
    }
  }

  // The name is optional. A piece with none shows as untitled.
  const name = String(form.get('name') || '').trim();

  // The id comes from the typed id, then the name, then the first file name.
  const fromFile = hasFile ? String(picked[0].name || '').replace(/\.[a-z0-9]+$/i, '') : '';
  const id = slugify(String(form.get('id') || '').trim() || name || fromFile);
  if (!id) return json({ error: 'Type an id. Nothing else gives one.' }, 400);

  // No fixed list. Each term is cleaned to its steady form and kept.
  // A code project has no medium, so the field stays an empty list.
  const mediums = kind === 'code' ? [] : normalizeList(form.getAll('mediums'));
  if (kind !== 'code' && mediums.length === 0) {
    return json({ error: 'Name at least one medium.' }, 400);
  }

  const tags = normalizeList(form.getAll('tags'));
  if (tags.length === 0) return json({ error: 'Pick at least one tag.' }, 400);

  const dateCreated = String(form.get('dateCreated') || '').trim();
  if (!dateCreated) return json({ error: 'Give the date created.' }, 400);
  if (!DATE_PATTERN.test(dateCreated)) {
    return json({ error: 'Write the date as YYYY-MM-DD.' }, 400);
  }

  const overwrite = String(form.get('overwrite')) === 'true';
  const existingRaw = await env.IMAGE_METADATA.get(id);
  const clash = Boolean(existingRaw);

  // An image row needs a picture. A code row may have none. An edit keeps
  // whatever the row already holds.
  if (!hasFile && kind === 'image' && !(overwrite && clash)) {
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

  const previous = existingRaw ? JSON.parse(existingRaw) : null;

  // A new set of pictures replaces the old one. An edit with none keeps what
  // the row already holds.
  const images = hasFile
    ? picked.map((item, index) => ({
        key: `${finalId}${index === 0 ? '' : `-${index + 1}`}.`
          + extensionOf(item.name || '', item.type),
        width: null,
        height: null
      }))
    : readImages(previous);
  // The wall picks a tile shape from the pixel size, so a portrait never
  // lands in a wide band. Read it from the header, not from the browser.
  if (hasFile) {
    await Promise.all(picked.map(async (item, index) => {
      const size = readImageSize(await item.slice(0, HEADER_BYTES).arrayBuffer());
      if (size) {
        images[index].width = size.width;
        images[index].height = size.height;
      } else {
        console.warn(`Could not read the size of "${images[index].key}".`);
      }
    }));
  }

  // The optional download. Any type, under its own prefix, so it never
  // looks like artwork to the gallery.
  const extra = form.get('download');
  const hasDownload = Boolean(extra) && typeof extra !== 'string' && extra.size > 0;

  if (hasDownload && extra.size > MAX_BYTES) {
    return json({ error: `The download is over the ${MAX_BYTES / 1024 / 1024}MB limit.` }, 413);
  }

  const keepDownload = String(form.get('keepDownload')) === 'true';
  let download = keepDownload && previous ? (previous.download ?? null) : null;

  if (hasDownload) {
    download = {
      key: `${FILE_PREFIX}${finalId}-${slugify(extra.name || 'file') || 'file'}`,
      name: String(extra.name || 'download'),
      size: extra.size,
      type: String(extra.type || 'application/octet-stream')
    };
  }

  const entry = {
    kind,
    name,
    images,
    description: String(form.get('description') || '').trim(),
    mediums,
    tags,
    dateCreated,
    galleries: splitList(String(form.get('galleries') || '')),
    sizeVersion: SIZE_VERSION,

    // Code fields. Every one is optional, and an image row leaves them empty.
    repoUrl: cleanUrl(form.get('repoUrl')),
    liveUrl: cleanUrl(form.get('liveUrl')),
    language: normalizeList([form.get('language')])[0] ?? '',
    snippet: readSnippet(form.get('snippet')).slice(0, MAX_SNIPPET),
    download
  };

  if (hasFile) {
    await Promise.all(picked.map((item, index) =>
      env.IMAGES.put(images[index].key, item.stream(), {
        httpMetadata: { contentType: item.type }
      })));
  }

  if (hasDownload) {
    await env.IMAGES.put(download.key, extra.stream(), {
      httpMetadata: { contentType: download.type }
    });
  }

  try {
    await env.IMAGE_METADATA.put(finalId, JSON.stringify(entry));
  } catch (error) {
    // Drop the new object, so a failed write leaves nothing behind in R2. An
    // edit that reused the old object must keep it.
    if (hasFile) await Promise.all(images.map(image => env.IMAGES.delete(image.key)));
    if (hasDownload) await env.IMAGES.delete(download.key);
    console.error('KV write failed:', error);
    return json({ error: 'The upload worked, but the metadata write failed.' }, 500);
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

  let images = [];
  try {
    images = readImages(JSON.parse(raw));
  } catch {
    console.error(`Unparseable entry "${id}". Deleting the key anyway.`);
  }

  let downloadKey = null;
  try {
    downloadKey = (JSON.parse(raw).download || {}).key || null;
  } catch {
    // Already reported above.
  }

  await env.IMAGE_METADATA.delete(id);
  await Promise.all(images.map(image => env.IMAGES.delete(image.key)));
  if (downloadKey) await env.IMAGES.delete(downloadKey);

  return json({ id, deleted: true, images: images.map(i => i.key), downloadKey });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  if (context.request.method === 'DELETE') return onRequestDelete(context);
  return new Response('Use POST or DELETE.', { status: 405, headers: { Allow: 'POST, DELETE' } });
}
