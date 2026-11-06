// Stores one small copy for a picture that has none. Private, and gated by
// src/gate.js.
//
// The Worker cannot decode an image, so the browser makes the copy and posts
// it here. public/thumbnails.html drives that for every row at once.
import { readImages } from '../../public/js/row.js';

const THUMB_PREFIX = 'thumbs/';
const MAX_BYTES = 4 * 1024 * 1024;   // a 938px webp never comes near this

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Send the copy as form data.' }, 400);
  }

  const id = String(form.get('id') || '').trim();
  const key = String(form.get('key') || '').trim();
  const copy = form.get('thumb');

  if (!id || !key) return json({ error: "Give both an id and a key." }, 400);
  if (!copy || typeof copy === 'string' || copy.size === 0) {
    return json({ error: 'The copy is empty.' }, 400);
  }
  if (copy.size > MAX_BYTES) return json({ error: 'That copy is too big.' }, 413);

  const raw = await env.IMAGE_METADATA.get(id);
  if (!raw) return json({ error: `No entry with the id "${id}".` }, 404);

  const stored = JSON.parse(raw);
  const images = readImages(stored);

  // The key must belong to this row, so one call cannot write anywhere else.
  const index = images.findIndex(image => image.key === key);
  if (index === -1) return json({ error: `"${key}" is not a picture of "${id}".` }, 400);

  const thumb = `${THUMB_PREFIX}${key}.webp`;
  await env.IMAGES.put(thumb, copy.stream(), {
    httpMetadata: { contentType: 'image/webp' }
  });

  images[index] = { ...images[index], thumb };
  await env.IMAGE_METADATA.put(id, JSON.stringify({ ...stored, images }));

  return json({ id, key, thumb, size: copy.size });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return new Response('Use POST.', { status: 405, headers: { Allow: 'POST' } });
}
