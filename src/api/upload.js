// Private upload endpoint. functions/_middleware.js gates it with Cloudflare
// Access, so this handler assumes the caller is already allowed.
//
// It writes the image bytes to R2, then writes the metadata entry to KV. The
// KV key is the image id. The R2 object key is the entry's filename.
import { isValidTag } from './_constants.js';

const MAX_BYTES = 25 * 1024 * 1024;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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
  if (!file || typeof file === 'string' || file.size === 0) {
    return json({ error: 'Choose an image file.' }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json({ error: `The file is over the ${MAX_BYTES / 1024 / 1024}MB limit.` }, 413);
  }
  if (!String(file.type).startsWith('image/')) {
    return json({ error: 'The file must be an image.' }, 415);
  }

  const name = String(form.get('name') || '').trim();
  if (!name) return json({ error: 'Give the piece a name.' }, 400);

  const id = slugify(String(form.get('id') || '').trim() || name);
  if (!id) return json({ error: 'The id is empty after cleanup. Type one.' }, 400);

  const tags = form.getAll('tags').map(tag => String(tag).trim()).filter(Boolean);
  const unknownTag = tags.find(tag => !isValidTag(tag));
  if (unknownTag) return json({ error: `Unknown tag: "${unknownTag}"` }, 400);

  const dateCreated = String(form.get('dateCreated') || '').trim();
  if (dateCreated && !DATE_PATTERN.test(dateCreated)) {
    return json({ error: 'Write the date as YYYY-MM-DD.' }, 400);
  }

  const overwrite = String(form.get('overwrite')) === 'true';
  const existing = await env.IMAGE_METADATA.get(id);
  if (existing && !overwrite) {
    return json({ error: `"${id}" already exists. Tick overwrite to replace it.` }, 409);
  }

  const filename = `${id}.${extensionOf(file.name || '', file.type)}`;
  const entry = {
    name,
    filename,
    description: String(form.get('description') || '').trim(),
    medium: String(form.get('medium') || '').trim(),
    tags,
    dateCreated,
    galleries: splitList(String(form.get('galleries') || ''))
  };

  await env.IMAGES.put(filename, file.stream(), {
    httpMetadata: { contentType: file.type }
  });

  try {
    await env.IMAGE_METADATA.put(id, JSON.stringify(entry));
  } catch (error) {
    // Drop the object, so a failed write leaves nothing behind in R2.
    await env.IMAGES.delete(filename);
    console.error('KV write failed:', error);
    return json({ error: 'The image upload worked, but the metadata write failed.' }, 500);
  }

  return json({ id, replaced: Boolean(existing), entry }, existing ? 200 : 201);
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return new Response('Use POST.', { status: 405, headers: { Allow: 'POST' } });
}
