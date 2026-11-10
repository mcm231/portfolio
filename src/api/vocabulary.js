// The terms already in use, for the suggestion lists.
//
// No fixed vocabulary exists. Every tag and every medium comes from the rows
// themselves, counted, most used first.
import { readTags, readMediums } from '../../public/js/shared/taxonomy.js';
import { rowRepository } from '../repositories/rowRepository.js';
import { json } from './_reply.js';

function tally(counts, terms) {
    for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
}

function rank(counts) {
    return [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export async function readVocabulary(request, env) {
    const tags = new Map();
    const mediums = new Map();

    // The stored rows are enough to count terms, so this never reads a single
    // image out of the bucket.
    for (const row of await rowRepository.listStored(env)) {
        tally(tags, readTags(row));
        tally(mediums, readMediums(row));
    }

    return json({ tags: rank(tags), mediums: rank(mediums) });
}
