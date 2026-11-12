// Serves an artwork image, or the small copy of one.
//
// The key comes from the visitor, so this route checks it before it reads the
// bucket. A project download and a contact message sit under their own
// prefixes, and neither one is reachable here.
import { imageRepository } from '../repositories/imageRepository.js';
import { badRequest, notFound, objectResponse } from './_reply.js';

export async function readImage(request, env) {
    const key = new URL(request.url).searchParams.get('id');

    if (!key) return badRequest("Missing required 'id' parameter");
    if (!imageRepository.isPublicKey(key)) return notFound();

    const object = await imageRepository.get(env, key);
    if (!object) return notFound();

    return objectResponse(object);
}
