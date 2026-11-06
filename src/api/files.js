// Serves a project download from the R2 bucket.
//
// Only an object under files/ is served, so this route can never hand out an
// artwork, a contact message, or anything else in the bucket.

const FILE_PREFIX = 'files/';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Use GET.', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const key = new URL(request.url).searchParams.get('key');

  if (!key || !key.startsWith(FILE_PREFIX) || key.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  const object = await env.IMAGES.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);

  // The browser saves the file rather than trying to display it.
  const name = key.slice(FILE_PREFIX.length).replace(/"/g, '');
  headers.set('Content-Disposition', `attachment; filename="${name}"`);

  return new Response(object.body, { headers });
}
