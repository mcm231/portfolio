// The image header reader, against real bytes for each type.
import { deflateSync } from 'node:zlib';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { readImageSize } = await import(`${ROOT}/src/repositories/_image-size.js`);

function png(w, h) {
    const chunk = (type, data) => {
        const out = Buffer.alloc(8 + data.length + 4);
        out.writeUInt32BE(data.length, 0);
        out.write(type, 4, 'ascii');
        data.copy(out, 8);
        return out;
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(Buffer.alloc(w * h * 3 + h))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function jpeg(w, h, { padBytes = 0 } = {}) {
    const sof = Buffer.alloc(19);
    sof.writeUInt16BE(0xffc0, 0);
    sof.writeUInt16BE(17, 2); // segment length
    sof[4] = 8; // precision
    sof.writeUInt16BE(h, 5);
    sof.writeUInt16BE(w, 7);
    sof[9] = 3; // component count
    // A filler segment, to prove the marker walk works.
    const filler = Buffer.alloc(4 + padBytes);
    filler.writeUInt16BE(0xffe0, 0);
    filler.writeUInt16BE(2 + padBytes, 2);
    return Buffer.concat([Buffer.from([0xff, 0xd8]), filler, sof, Buffer.from([0xff, 0xd9])]);
}

// A JPEG whose Exif block says the camera was turned. The browser draws it a
// quarter turn round, so the reader must swap the two numbers.
function jpegWithOrientation(w, h, orientation) {
    const exifBody = Buffer.alloc(32); // the entry plus the next IFD offset
    exifBody.write('Exif', 0, 'ascii'); // 4 bytes, then two zeros
    const tiff = 6;
    exifBody.write('MM', tiff, 'ascii'); // big endian
    exifBody.writeUInt16BE(0x002a, tiff + 2);
    exifBody.writeUInt32BE(8, tiff + 4); // IFD0 sits right after
    exifBody.writeUInt16BE(1, tiff + 8); // one entry
    exifBody.writeUInt16BE(0x0112, tiff + 10); // the orientation tag
    exifBody.writeUInt16BE(3, tiff + 12); // type SHORT
    exifBody.writeUInt32BE(1, tiff + 14); // count
    exifBody.writeUInt16BE(orientation, tiff + 18);

    const app1 = Buffer.alloc(4 + exifBody.length);
    app1.writeUInt16BE(0xffe1, 0);
    app1.writeUInt16BE(2 + exifBody.length, 2);
    exifBody.copy(app1, 4);

    const sof = Buffer.alloc(19);
    sof.writeUInt16BE(0xffc0, 0);
    sof.writeUInt16BE(17, 2);
    sof[4] = 8;
    sof.writeUInt16BE(h, 5);
    sof.writeUInt16BE(w, 7);
    sof[9] = 3;

    return Buffer.concat([
        Buffer.from([0xff, 0xd8]),
        app1,
        sof,
        Buffer.alloc(40),
        Buffer.from([0xff, 0xd9]),
    ]);
}

function gif(w, h) {
    const out = Buffer.alloc(32);
    out.write('GIF89a', 0, 'ascii');
    out.writeUInt16LE(w, 6);
    out.writeUInt16LE(h, 8);
    return out;
}

function webpVp8x(w, h) {
    const out = Buffer.alloc(40);
    out.write('RIFF', 0, 'ascii');
    out.write('WEBP', 8, 'ascii');
    out.write('VP8X', 12, 'ascii');
    out.writeUIntLE(w - 1, 24, 3);
    out.writeUIntLE(h - 1, 27, 3);
    return out;
}

const buf = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

const results = [];
const check = (label, got, want) =>
    results.push([label, JSON.stringify(got), JSON.stringify(want)]);

check('png landscape', readImageSize(buf(png(800, 600))), { width: 800, height: 600 });
check('png portrait', readImageSize(buf(png(600, 900))), { width: 600, height: 900 });
check('png square', readImageSize(buf(png(512, 512))), { width: 512, height: 512 });
check('jpeg landscape', readImageSize(buf(jpeg(1920, 1080, { padBytes: 40 }))), {
    width: 1920,
    height: 1080,
});
check('jpeg portrait', readImageSize(buf(jpeg(1080, 1920, { padBytes: 40 }))), {
    width: 1080,
    height: 1920,
});
check('jpeg past a long segment', readImageSize(buf(jpeg(400, 300, { padBytes: 900 }))), {
    width: 400,
    height: 300,
});
check('gif', readImageSize(buf(gif(320, 240))), { width: 320, height: 240 });
check('webp vp8x', readImageSize(buf(webpVp8x(1024, 768))), { width: 1024, height: 768 });

// A phone photo puts a full size Exif block before the frame marker. The
// reader must walk past it, and the caller must send enough bytes.
const withExif = jpeg(4080, 3072, { padBytes: 65531 });
check('the frame sits past 64KB', withExif.length > 65536, true);
check('a phone photo parses', readImageSize(buf(withExif)), { width: 4080, height: 3072 });
check('a 64KB window is too small', readImageSize(buf(withExif.subarray(0, 65536))), null);

// A turned photo. Orientations 5 to 8 swap the two numbers, 1 to 4 do not.
check('orientation 6 swaps', readImageSize(buf(jpegWithOrientation(4080, 3072, 6))), {
    width: 3072,
    height: 4080,
});
check('orientation 8 swaps', readImageSize(buf(jpegWithOrientation(4080, 3072, 8))), {
    width: 3072,
    height: 4080,
});
check('orientation 1 holds', readImageSize(buf(jpegWithOrientation(4080, 3072, 1))), {
    width: 4080,
    height: 3072,
});
check('orientation 3 holds', readImageSize(buf(jpegWithOrientation(4080, 3072, 3))), {
    width: 4080,
    height: 3072,
});

check('a short buffer gives null', readImageSize(buf(Buffer.alloc(8))), null);
check('junk bytes give null', readImageSize(buf(Buffer.alloc(200, 0x5a))), null);
check('no buffer gives null', readImageSize(null), null);

let failed = 0;
for (const [label, got, want] of results) {
    const pass = got === want;
    if (!pass) failed++;
    console.log(
        `${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(28)} ${got}${pass ? '' : `  want ${want}`}`
    );
}
console.log(failed === 0 ? '\nall cases pass' : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
