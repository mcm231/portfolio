// Makes a small copy of a picture, in the browser.
//
// The wall never draws a tile wider than 469px, but a stored photo is three
// to four times that. A 938px copy still looks sharp on a retina screen, and
// a phone photo drops from megabytes to kilobytes.
//
// Cloudflare resizes at the edge only for a zone you own, and a workers.dev
// subdomain has none. The canvas in the browser does the work instead.

export const THUMB_WIDTH = 938;
export const THUMB_TYPE = 'image/webp';
export const THUMB_QUALITY = 0.82;
export const THUMB_PREFIX = 'thumbs/';

// The object key of a picture's small copy. The extension says webp, because
// the bytes are webp whatever the original was.
export function thumbKey(key) {
    return `${THUMB_PREFIX}${key}.webp`;
}

function drawToBlob(source, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, width, height);

    return new Promise(resolve => canvas.toBlob(resolve, THUMB_TYPE, THUMB_QUALITY));
}

// A Blob or a File in, a smaller Blob out.
//
// Returns null when the picture is already small enough, or when the browser
// cannot read it. The caller then stores the original alone, and the wall
// falls back to it.
export async function makeThumbnail(source) {
    let bitmap;
    try {
        bitmap = await createImageBitmap(source);
    } catch (error) {
        console.warn('Could not read the picture for a small copy:', error);
        return null;
    }

    try {
        if (bitmap.width <= THUMB_WIDTH) return null;

        const height = Math.round(bitmap.height * (THUMB_WIDTH / bitmap.width));
        return await drawToBlob(bitmap, THUMB_WIDTH, height);
    } finally {
        bitmap.close();
    }
}
