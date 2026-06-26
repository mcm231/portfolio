export async function onRequest(context) {
  const url = new URL(context.request.url);
  const imageId = url.searchParams.get("id");

  if (imageId) {
    const value = await context.env.IMAGE_METADATA.get(imageId);
    if (!value) return new Response("Not found", { status: 404 });
    return new Response(value, {
      headers: { "Content-Type": "application/json" }
    });
  }

  // list all keys (paginated — KV list returns up to 1000 at a time)
  const list = await context.env.IMAGE_METADATA.list();
  const entries = await Promise.all(
    list.keys.map(async ({ name }) => {
      const value = await context.env.IMAGE_METADATA.get(name);
      return { id: name, ...JSON.parse(value) };
    })
  );
  return new Response(JSON.stringify(entries), {
    headers: { "Content-Type": "application/json" }
  });
}
