// Serves an artwork image, or the small copy of one.
//
// The key comes from the visitor, so this route checks it before it reads the
// bucket. A project download and a contact message sit under their own
// prefixes, and neither one is reachable here.
import { imageRepository } from '../repositories/imageRepository.js';
import { badRequest, notFound, objectResponse, IMAGE_CACHE } from './_reply.js';

export async function readImage(request, env) {
    const key = new URL(request.url).searchParams.get('id');

    if (!key) return badRequest("Missing required 'id' parameter");
    if (!imageRepository.isPublicKey(key)) return notFound();

    // The visitor may hold these bytes already. The bucket compares the etag,
    // and answers without a body when the picture did not change.
    const unlessEtag = request.headers.get('if-none-match');

    const object = await imageRepository.get(env, key, { unlessEtag });
    if (!object) return notFound();

    return objectResponse(object, { 'Cache-Control': IMAGE_CACHE });
}
