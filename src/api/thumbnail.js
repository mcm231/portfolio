// Stores one small copy for a picture that has none. Private, and gated by
// src/gate.js.
//
// The Worker cannot decode an image, so the browser makes the copy and posts
// it here. public/pages/thumbnails.html drives that for every row at once.
import { readImages } from '../../public/js/shared/row.js';
import { imageRepository } from '../repositories/imageRepository.js';
import { rowRepository } from '../repositories/rowRepository.js';
import { badRequest, json } from './_reply.js';

const MAX_BYTES = 4 * 1024 * 1024; // a 938px webp never comes near this

export async function saveThumbnail(request, env) {
    let form;
    try {
        form = await request.formData();
    } catch {
        return badRequest('Send the copy as form data.');
    }

    const id = String(form.get('id') || '').trim();
    const key = String(form.get('key') || '').trim();
    const copy = form.get('thumb');

    if (!id || !key) return badRequest('Give both an id and a key.');
    if (!copy || typeof copy === 'string' || copy.size === 0) {
        return badRequest('The copy is empty.');
    }
    if (copy.size > MAX_BYTES) return badRequest('That copy is too big.', 413);

    const stored = await rowRepository.getStored(env, id);
    if (!stored) return badRequest(`No entry with the id "${id}".`, 404);

    const images = readImages(stored);

    // The key must belong to this row, so one call cannot write anywhere else.
    const index = images.findIndex(image => image.key === key);
    if (index === -1) return badRequest(`"${key}" is not a picture of "${id}".`);

    const thumb = await imageRepository.putThumb(env, key, copy.stream());

    images[index] = { ...images[index], thumb };
    await rowRepository.put(env, id, { ...stored, images });

    return json({ id, key, thumb, size: copy.size });
}
