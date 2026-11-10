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

// The bytes of an R2 object, with the type and the etag the bucket stored.
export function objectResponse(object, extraHeaders = {}) {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    for (const [name, value] of Object.entries(extraHeaders)) headers.set(name, value);

    return new Response(object.body, { headers });
}
