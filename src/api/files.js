// Serves a project download.
//
// The key comes from the visitor, so this route refuses any key outside the
// download prefix. It can never hand out an artwork or a contact message.
import { imageRepository } from '../repositories/imageRepository.js';
import { notFound, objectResponse } from './_reply.js';

export async function readFile(request, env) {
    const key = new URL(request.url).searchParams.get('key');

    if (!imageRepository.isFileKey(key)) return notFound();

    const object = await imageRepository.get(env, key);
    if (!object) return notFound();

    // The browser saves the file rather than trying to show it.
    const name = imageRepository.fileNameOf(key);

    return objectResponse(object, { 'Content-Disposition': `attachment; filename="${name}"` });
}
