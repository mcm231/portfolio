// Every row in the IMAGE_METADATA namespace. The KV key is the row id.
//
// Two shapes exist, and this file is the only place that knows both:
//
//   stored    the row as the database holds it. An old row holds an old shape
//   resolved  the row a reader sees. It carries an id, a kind, and the lists
//
// `get` and `list` resolve. `getStored` and `listStored` do not, for a caller
// that only counts terms or edits the row it just read. DATA_MODEL.md names
// every field and every promotion.
import { readTags, readMediums } from '../../public/js/shared/taxonomy.js';
import { readImages } from '../../public/js/shared/row.js';
import { readImageSize } from './_image-size.js';
import { imageRepository } from './imageRepository.js';

// Raise this when the size reader changes. A row stamped with an older number
// gets read again, so a parser fix reaches the rows already stored.
export const SIZE_VERSION = 2;

function parse(id, value) {
    try {
        return JSON.parse(value);
    } catch {
        console.error(`Skipping unparseable IMAGE_METADATA entry: "${id}"`);
        return null;
    }
}

// Three kinds of row live in this namespace.
//
//   image  a picture. The row names the object in the R2 bucket.
//   code   a program. It may carry a picture, a snippet, links and a download.
//          With no picture, the tile shows code.
//   panel  a piece with no picture and no code, such as a story. The tile
//          shows a color block.
//
// A row written by the upload page stores its kind. An older row has none, so
// the kind comes from the fields. Every row reports one, and no page guesses.
function kindOf(stored, images) {
    return stored.kind || (images.length > 0 ? 'image' : 'panel');
}

// An older row holds one `medium` string and one `filename`. A reader only
// ever sees the lists: `mediums` and `images`.
function promote(id, stored) {
    const row = {
        id,
        ...stored,
        tags: readTags(stored),
        mediums: readMediums(stored),
        images: readImages(stored),
    };

    delete row.medium;
    delete row.filename;
    delete row.width;
    delete row.height;

    return { ...row, kind: kindOf(stored, row.images) };
}

// Drops a picture whose object is gone, rather than fail the whole row. An
// image row that loses every picture is skipped, because it has nothing left
// to draw.
async function withPresentImages(env, id, row) {
    if (row.images.length === 0) return row;

    const present = [];
    for (const image of row.images) {
        if (await imageRepository.head(env, image.key)) present.push(image);
        else console.error(`Entry "${id}": image "${image.key}" is not in R2`);
    }

    if (present.length === 0 && row.kind === 'image') {
        console.error(`Skipping entry "${id}": no image survived`);
        return null;
    }

    return { ...row, images: present };
}

// Fills in any picture size the row does not hold, by reading the object
// header once, and keeps the answer.
//
// The write builds on the stored row, never on the resolved one, so a field
// the read path adds can never become a stored one.
async function withSizes(env, id, row, stored) {
    const missing = row.images.some(
        image => !image.width || !image.height || row.sizeVersion !== SIZE_VERSION
    );
    if (!missing) return row;

    const filled = await Promise.all(
        row.images.map(async image => {
            if (image.width && image.height && row.sizeVersion === SIZE_VERSION) return image;

            const header = await imageRepository.readHeader(env, image.key);
            if (!header) return image;

            try {
                const size = readImageSize(header);
                return size ? { ...image, width: size.width, height: size.height } : image;
            } catch (error) {
                console.error(`Could not read the header of "${image.key}":`, error);
                return image;
            }
        })
    );

    const changed = filled.some(
        (image, index) =>
            image.width !== row.images[index].width || image.height !== row.images[index].height
    );
    if (!changed && row.sizeVersion === SIZE_VERSION) return row;

    // A size fix also saves the promoted lists, so an old row ends up in the
    // current shape. The legacy singles go, and a stored `kind` stays, because
    // `stored` carries it and nothing here invents one.
    const { medium, filename, width, height, ...rest } = stored;

    await env.IMAGE_METADATA.put(
        id,
        JSON.stringify({
            ...rest,
            tags: row.tags,
            mediums: row.mediums,
            images: filled,
            sizeVersion: SIZE_VERSION,
        })
    );

    return { ...row, images: filled, sizeVersion: SIZE_VERSION };
}

async function resolve(env, id, value) {
    const stored = parse(id, value);
    if (!stored) return null;

    const present = await withPresentImages(env, id, promote(id, stored));
    if (!present) return null;

    return withSizes(env, id, present, stored);
}

async function eachKey(env, read) {
    const rows = [];
    let cursor;

    do {
        const page = await env.IMAGE_METADATA.list({ cursor });
        const batch = await Promise.all(page.keys.map(({ name }) => read(name)));
        rows.push(...batch.filter(Boolean));
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    return rows;
}

export const rowRepository = {
    async get(env, id) {
        const value = await env.IMAGE_METADATA.get(id);
        if (!value) return null;
        return resolve(env, id, value);
    },

    async list(env) {
        return eachKey(env, async id => {
            const value = await env.IMAGE_METADATA.get(id);
            return value ? resolve(env, id, value) : null;
        });
    },

    async getStored(env, id) {
        const value = await env.IMAGE_METADATA.get(id);
        return value ? parse(id, value) : null;
    },

    async listStored(env) {
        return eachKey(env, async id => {
            const value = await env.IMAGE_METADATA.get(id);
            return value ? parse(id, value) : null;
        });
    },

    async exists(env, id) {
        return Boolean(await env.IMAGE_METADATA.get(id));
    },

    async put(env, id, row) {
        return env.IMAGE_METADATA.put(id, JSON.stringify(row));
    },

    async delete(env, id) {
        return env.IMAGE_METADATA.delete(id);
    },
};
