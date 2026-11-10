// The private upload endpoint. src/gate.js checks the caller first, so this
// route assumes the person is allowed.
//
// It writes the picture bytes, then the row. The row goes last, so a failed
// write leaves an unused object rather than a row pointing at nothing.
import { normalizeList } from '../../public/js/shared/taxonomy.js';
import { readImages, readSnippet } from '../../public/js/shared/row.js';
// The browser loads the same file over HTTP, so the rules cannot drift.
import { slugify, freeId } from '../../public/js/shared/id-rules.js';
import { readImageSize } from '../repositories/_image-size.js';
import { imageRepository } from '../repositories/imageRepository.js';
import { rowRepository, SIZE_VERSION } from '../repositories/rowRepository.js';
import { badRequest, json, serverError } from './_reply.js';

const HEADER_BYTES = 262144; // reaches past the Exif block of a phone photo
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_MB = MAX_BYTES / 1024 / 1024;
const MAX_SNIPPET = 2000;
const MAX_IMAGES = 12;
const KINDS = new Set(['image', 'code']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function extensionOf(filename, contentType) {
    const fromName = (filename.match(/\.([a-z0-9]+)$/i) || [])[1];
    if (fromName) return fromName.toLowerCase();

    const fromType = (contentType.match(/^image\/([a-z0-9+.-]+)$/i) || [])[1];
    return fromType ? fromType.replace('jpeg', 'jpg') : 'bin';
}

// A link the browser can open. Anything else is refused, so a row cannot
// carry a javascript: url into a page.
function cleanUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
        const url = new URL(raw);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
    } catch {
        return '';
    }
}

function splitList(value) {
    return (value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

export async function saveRow(request, env) {
    let form;
    try {
        form = await request.formData();
    } catch {
        return badRequest('Send the upload as multipart form data.');
    }

    // The kind is stored, not guessed. An image row needs a picture. A code
    // row does not, because its tile can show code instead.
    const kind = KINDS.has(String(form.get('kind'))) ? String(form.get('kind')) : 'image';

    // A row may carry several pictures. The first one is the cover.
    const picked = form
        .getAll('file')
        .filter(item => item && typeof item !== 'string' && item.size > 0)
        .slice(0, MAX_IMAGES);
    const hasFile = picked.length > 0;

    for (const item of picked) {
        if (item.size > MAX_BYTES) {
            return badRequest(`"${item.name}" is over the ${MAX_MB}MB limit.`, 413);
        }
        if (!String(item.type).startsWith('image/')) {
            return badRequest(`"${item.name}" is not an image.`, 415);
        }
    }

    // The name is optional. A piece with none shows as untitled.
    const name = String(form.get('name') || '').trim();

    // The id comes from the typed id, then the name, then the first file name.
    const fromFile = hasFile ? String(picked[0].name || '').replace(/\.[a-z0-9]+$/i, '') : '';
    const id = slugify(String(form.get('id') || '').trim() || name || fromFile);
    if (!id) return badRequest('Type an id. Nothing else gives one.');

    // No fixed list. Each term is cleaned to its steady form and kept. A code
    // project has no medium, so the field stays an empty list.
    const mediums = kind === 'code' ? [] : normalizeList(form.getAll('mediums'));
    if (kind !== 'code' && mediums.length === 0) {
        return badRequest('Name at least one medium.');
    }

    const tags = normalizeList(form.getAll('tags'));
    if (tags.length === 0) return badRequest('Pick at least one tag.');

    const dateCreated = String(form.get('dateCreated') || '').trim();
    if (!dateCreated) return badRequest('Give the date created.');
    if (!DATE_PATTERN.test(dateCreated)) return badRequest('Write the date as YYYY-MM-DD.');

    const overwrite = String(form.get('overwrite')) === 'true';
    const previous = await rowRepository.getStored(env, id);
    const clash = Boolean(previous);

    // An image row needs a picture. A code row may have none. An edit keeps
    // whatever the row already holds.
    if (!hasFile && kind === 'image' && !(overwrite && clash)) {
        return badRequest('Choose an image file.');
    }

    // A clash adds a number, or raises the number already there. Overwrite is
    // the one case that keeps the id and replaces the row.
    let finalId = id;
    if (clash && !overwrite) {
        try {
            finalId = await freeId(id, key => rowRepository.exists(env, key));
        } catch (error) {
            console.error(error);
            return badRequest('Every numbered id is taken. Type a different one.', 409);
        }
    }

    // The small copies the browser made, one for each picture, in the same
    // order. An empty part means the browser could not read that one.
    const copies = form
        .getAll('thumb')
        .map(item => (item && typeof item !== 'string' && item.size > 0 ? item : null));

    // A new set of pictures replaces the old one. An edit with none keeps what
    // the row already holds.
    const images = hasFile
        ? picked.map((item, index) => {
              const key =
                  `${finalId}${index === 0 ? '' : `-${index + 1}`}.` +
                  extensionOf(item.name || '', item.type);

              return {
                  key,
                  thumb: copies[index] ? imageRepository.thumbKeyFor(key) : null,
                  width: null,
                  height: null,
              };
          })
        : readImages(previous);

    // The wall picks a tile shape from the pixel size, so a portrait never
    // lands in a wide band. Read it from the header, not from the browser.
    if (hasFile) {
        await Promise.all(
            picked.map(async (item, index) => {
                const size = readImageSize(await item.slice(0, HEADER_BYTES).arrayBuffer());
                if (size) {
                    images[index].width = size.width;
                    images[index].height = size.height;
                } else {
                    console.warn(`Could not read the size of "${images[index].key}".`);
                }
            })
        );
    }

    // The optional download. Any type, under its own prefix, so it never looks
    // like artwork to the gallery.
    const extra = form.get('download');
    const hasDownload = Boolean(extra) && typeof extra !== 'string' && extra.size > 0;

    if (hasDownload && extra.size > MAX_BYTES) {
        return badRequest(`The download is over the ${MAX_MB}MB limit.`, 413);
    }

    const keepDownload = String(form.get('keepDownload')) === 'true';
    let download = keepDownload && previous ? (previous.download ?? null) : null;

    if (hasDownload) {
        download = {
            key: imageRepository.fileKeyFor(finalId, slugify(extra.name || 'file') || 'file'),
            name: String(extra.name || 'download'),
            size: extra.size,
            type: String(extra.type || 'application/octet-stream'),
        };
    }

    const row = {
        kind,
        name,
        images,
        description: String(form.get('description') || '').trim(),
        mediums,
        tags,
        dateCreated,
        galleries: splitList(String(form.get('galleries') || '')),
        sizeVersion: SIZE_VERSION,

        // Code fields. Every one is optional, and an image row leaves them
        // empty.
        repoUrl: cleanUrl(form.get('repoUrl')),
        liveUrl: cleanUrl(form.get('liveUrl')),
        language: normalizeList([form.get('language')])[0] ?? '',
        snippet: readSnippet(form.get('snippet')).slice(0, MAX_SNIPPET),
        download,
    };

    if (hasFile) {
        await Promise.all(
            picked.map((item, index) =>
                imageRepository.put(env, images[index].key, item.stream(), item.type)
            )
        );

        await Promise.all(
            images.map((image, index) =>
                image.thumb
                    ? imageRepository.putThumb(env, image.key, copies[index].stream())
                    : null
            )
        );
    }

    if (hasDownload) {
        await imageRepository.put(env, download.key, extra.stream(), download.type);
    }

    try {
        await rowRepository.put(env, finalId, row);
    } catch (error) {
        // Drop the new objects, so a failed write leaves nothing behind. An
        // edit that reused the old object must keep it.
        if (hasFile) await removeObjects(env, images);
        if (hasDownload) await imageRepository.delete(env, download.key);

        console.error('KV write failed:', error);
        return serverError('The upload worked, but the metadata write failed.');
    }

    const replaced = clash && overwrite;

    return json(
        { id: finalId, replaced, renamedFrom: finalId === id ? null : id, entry: row },
        replaced ? 200 : 201
    );
}

function removeObjects(env, images) {
    return Promise.all(
        images.flatMap(image =>
            [
                imageRepository.delete(env, image.key),
                image.thumb ? imageRepository.delete(env, image.thumb) : null,
            ].filter(Boolean)
        )
    );
}

// Removes the row, then the objects. The row goes first, so a half-finished
// delete leaves an unused object rather than a broken row.
export async function deleteRow(request, env) {
    const id = new URL(request.url).searchParams.get('id');

    if (!id) return badRequest("Missing the 'id' parameter.");

    const stored = await rowRepository.getStored(env, id);

    if (!stored) {
        if (!(await rowRepository.exists(env, id))) {
            return badRequest(`No entry with the id "${id}".`, 404);
        }

        // The row is there but unreadable. Nothing can parse it, so drop the
        // key and leave the objects for a manual look.
        await rowRepository.delete(env, id);
        return json({ id, deleted: true, images: [], downloadKey: null });
    }

    const images = readImages(stored);
    const downloadKey = (stored.download || {}).key || null;

    await rowRepository.delete(env, id);
    await removeObjects(env, images);
    if (downloadKey) await imageRepository.delete(env, downloadKey);

    return json({ id, deleted: true, images: images.map(image => image.key), downloadKey });
}
