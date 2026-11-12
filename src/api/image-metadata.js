// Reads rows for a page. Every filter is a query parameter.
//
//   ?id=<row id>   one row
//   ?tag=&medium=  every row matching both terms
//
// No fixed vocabulary exists, so any term is a valid query. One that nobody
// has used matches nothing.
import { normalizeTerm } from '../../public/js/shared/taxonomy.js';
import { rowRepository } from '../repositories/rowRepository.js';
import { json, notFound } from './_reply.js';

export async function readRows(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
        const row = await rowRepository.get(env, id);
        return row ? json(row) : notFound();
    }

    const tag = url.searchParams.get('tag');
    const medium = url.searchParams.get('medium');
    const wantedTag = tag === null ? null : normalizeTerm(tag);
    const wantedMedium = medium === null ? null : normalizeTerm(medium);

    const rows = await rowRepository.list(env);

    return json(
        rows.filter(
            row =>
                (!wantedTag || row.tags.includes(wantedTag)) &&
                (!wantedMedium || row.mediums.includes(wantedMedium))
        )
    );
}
