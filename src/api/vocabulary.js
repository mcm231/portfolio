// The words already in use, for the suggestion lists.
//
// There is no fixed vocabulary. Every tag and every medium comes from the
// rows themselves, counted, most used first.
import { readTags, readMediums } from '../../public/js/taxonomy.js';

function tally(counts, terms) {
  for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
}

function rank(counts) {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export async function onRequest(context) {
  const tags = new Map();
  const mediums = new Map();
  let cursor;

  do {
    const list = await context.env.IMAGE_METADATA.list({ cursor });

    await Promise.all(list.keys.map(async ({ name }) => {
      const value = await context.env.IMAGE_METADATA.get(name);
      if (!value) return;

      let entry;
      try {
        entry = JSON.parse(value);
      } catch {
        console.error(`Skipping unparseable entry "${name}" in the vocabulary.`);
        return;
      }

      tally(tags, readTags(entry));
      tally(mediums, readMediums(entry));
    }));

    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return new Response(JSON.stringify({ tags: rank(tags), mediums: rank(mediums) }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
