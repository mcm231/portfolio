// Every reply a route sends. One file holds the headers and the status codes,
// so no route builds them by hand.
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

export function json(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS } });
}

export function badRequest(message, status = 400) {
    return json({ error: message }, status);
}

export function notFound(message = 'Not found') {
    return new Response(message, { status: 404, headers: { 'Content-Type': 'text/plain' } });
}

export function serverError(message) {
    return json({ error: message }, 500);
}

export function methodNotAllowed(methods) {
    const allow = methods.join(', ');
    return new Response(`Use ${allow}.`, { status: 405, headers: { Allow: allow } });
}

// How long a browser and the edge may keep an artwork. A re-upload reuses the
// object key, so one day bounds how long a replaced picture can linger.
export const IMAGE_CACHE = 'public, max-age=86400';

// The bytes of an R2 object, with the type and the etag the bucket stored.
//
// An object without a body answers 304. The caller asked with an etag, the
// bucket compared it, and the bytes the caller holds are still current.
export function objectResponse(object, extraHeaders = {}) {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value);

    if (!object.body) return new Response(null, { status: 304, headers });

    return new Response(object.body, { headers });
}
