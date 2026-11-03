import { TAGS, TAGS_SET } from "./_constants.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);

  // ?all=true lists every tag in the enum, including the unused ones. The
  // upload form needs the full list.
  const includeUnused = url.searchParams.get("all") === "true";

  const tagCounts = {};
  if (includeUnused) for (const tag of TAGS) tagCounts[tag] = 0;
  let cursor;

  do {
    const list = await context.env.IMAGE_METADATA.list({ cursor });
    await Promise.all(
      list.keys.map(async ({ name }) => {
        const value = await context.env.IMAGE_METADATA.get(name);
        if (!value) return;
        const entry = JSON.parse(value);
        if (!Array.isArray(entry.tags)) return;

        for (const tag of entry.tags) {
          if (!TAGS_SET.has(tag)) continue;
          tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
        }
      })
    );
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  const tags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return new Response(JSON.stringify(tags), {
    headers: { "Content-Type": "application/json" }
  });
}
