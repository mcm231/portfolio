// Reads the pixel size out of an image header. Covers PNG, JPEG, GIF and
// WebP, which is every type a browser will send from a file picker.
//
// Returns { width, height }, or null when the bytes do not say.

function readPng(view) {
  // 8 byte signature, then the IHDR chunk: length, type, width, height.
  if (view.getUint32(0) !== 0x89504e47) return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readGif(view) {
  if (view.getUint32(0) !== 0x47494638) return null;   // "GIF8"
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function readWebp(view) {
  if (view.getUint32(0) !== 0x52494646) return null;   // "RIFF"
  if (view.getUint32(8) !== 0x57454250) return null;   // "WEBP"

  const chunk = view.getUint32(12);
  if (chunk === 0x56503858) {                          // "VP8X", the extended form
    const w = view.getUint8(24) | (view.getUint8(25) << 8) | (view.getUint8(26) << 16);
    const h = view.getUint8(27) | (view.getUint8(28) << 8) | (view.getUint8(29) << 16);
    return { width: w + 1, height: h + 1 };
  }
  if (chunk === 0x56503820) {                          // "VP8 ", the lossy form
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff
    };
  }
  return null;                                          // VP8L, rare from a picker
}

// The Exif orientation tag, when the APP1 segment carries one. Values 5 to 8
// mean the camera was turned, and the browser draws the image rotated a
// quarter turn. The stored width and height then read the wrong way round.
function readJpegOrientation(view, start, length) {
  // "Exif\0\0", then a TIFF header.
  if (view.getUint32(start) !== 0x45786966) return null;

  const tiff = start + 6;
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return null;

  const little = order === 0x4949;
  const ifd = tiff + view.getUint32(tiff + 4, little);
  const count = view.getUint16(ifd, little);
  const end = start + length;

  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end || entry + 12 > view.byteLength) break;

    if (view.getUint16(entry, little) === 0x0112) {
      return view.getUint16(entry + 8, little);
    }
  }
  return null;
}

function readJpeg(view) {
  if (view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  let orientation = null;

  while (offset + 9 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) { offset++; continue; }

    const marker = view.getUint8(offset + 1);
    const length = view.getUint16(offset + 2);

    // APP1 holds the Exif block, which may say the image is turned.
    if (marker === 0xe1 && orientation === null) {
      try {
        orientation = readJpegOrientation(view, offset + 4, length - 2);
      } catch {
        orientation = null;
      }
    }

    // A start of frame marker carries the size. C4, C8 and CC do not.
    const isFrame = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isFrame) {
      const height = view.getUint16(offset + 5);
      const width = view.getUint16(offset + 7);

      // A quarter turn swaps what the browser draws.
      return orientation >= 5 && orientation <= 8
        ? { width: height, height: width }
        : { width, height };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

export function readImageSize(buffer) {
  if (!buffer || buffer.byteLength < 24) return null;

  const view = new DataView(buffer);
  for (const read of [readPng, readGif, readWebp, readJpeg]) {
    try {
      const size = read(view);
      if (size && size.width > 0 && size.height > 0) return size;
    } catch {
      // A truncated header. Try the next reader.
    }
  }
  return null;
}
