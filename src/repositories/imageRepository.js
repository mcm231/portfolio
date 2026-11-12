// Every object in the IMAGES bucket except a contact message, which
// messageRepository owns.
//
// One bucket holds artwork, small copies, and project downloads. A prefix
// keeps each kind out of the others' way, and the prefix strings live here.
// A route asks this file whether a key is allowed, so no route builds one.
import { THUMB_PREFIX, thumbKey } from '../../public/js/shared/thumbnail.js';

const FILE_PREFIX = 'files/';

// How much of an image to read when only the size is wanted. It reaches past
// the Exif block of a phone photo.
const HEADER_BYTES = 262144;

export const imageRepository = {
    // An artwork object, or the small copy of one. Nothing else: a key with a
    // slash must name a copy, so no caller can walk into another prefix.
    isPublicKey(key) {
        if (!key || key.includes('..')) return false;
        if (key.startsWith(THUMB_PREFIX)) return !key.slice(THUMB_PREFIX.length).includes('/');
        return !key.includes('/');
    },

    isFileKey(key) {
        return Boolean(key) && key.startsWith(FILE_PREFIX) && !key.includes('..');
    },

    // The object key of a project download, and the file name inside it.
    fileKeyFor(id, filename) {
        return `${FILE_PREFIX}${id}-${filename}`;
    },

    fileNameOf(key) {
        return key.slice(FILE_PREFIX.length).replace(/"/g, '');
    },

    thumbKeyFor(key) {
        return thumbKey(key);
    },

    async get(env, key) {
        return env.IMAGES.get(key);
    },

    async head(env, key) {
        return env.IMAGES.head(key);
    },

    // The first bytes of an object, for the size reader. Returns null when the
    // object is gone, or when the binding cannot range read.
    async readHeader(env, key) {
        const object = await env.IMAGES.get(key, { range: { offset: 0, length: HEADER_BYTES } });
        if (!object || typeof object.arrayBuffer !== 'function') return null;
        return object.arrayBuffer();
    },

    async put(env, key, body, contentType) {
        return env.IMAGES.put(key, body, { httpMetadata: { contentType } });
    },

    async putThumb(env, key, body) {
        const thumb = thumbKey(key);
        await env.IMAGES.put(thumb, body, { httpMetadata: { contentType: 'image/webp' } });
        return thumb;
    },

    async delete(env, key) {
        return env.IMAGES.delete(key);
    },
};
