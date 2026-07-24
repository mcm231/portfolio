import { isValidTag } from "./_constants.js";

async function getAllEntries(kv) {
  const entries = [];
  let cursor;
  do {
    const list = await kv.list({ cursor });
    const batch = await Promise.all(
      list.keys.map(async ({ name }) => {
        const value = await kv.get(name);
        if (!value) return null;
        try {
          return { id: name, ...JSON.parse(value) };
        } catch {
          console.error(`Skipping unparseable IMAGE_METADATA entry: "${name}"`);
          return null;
        }
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
