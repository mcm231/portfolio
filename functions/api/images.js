export async function onRequest(context) {
  const url = new URL(context.request.url);
  const imageId = url.searchParams.get("id");

  if (!imageId) {
    return new Response(JSON.stringify({ error: "Missing required 'id' parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const object = await context.env.IMAGES.get(imageId);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  return new Response(object.body, { headers });
}
