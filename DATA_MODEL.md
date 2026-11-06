# Data model

Every piece of work on this site is one row in the `IMAGE_METADATA` KV
namespace. Every byte sits in the `IMAGES` R2 bucket. `README.md` covers how to
bind both and how to run the site. `ARCHITECTURE_GUIDE.md` covers which code may
read them.

## Where the bytes go

One bucket, four prefixes.

| Prefix | Holds | Served by |
|---|---|---|
| no prefix | An artwork image | `/api/images?id=<key>` |
| `thumbs/` | A 938px copy of a picture | `/api/images?id=thumbs/...` |
| `files/` | A project download | `/api/files?key=files/...` |
| `messages/` | A contact message | `/api/messages`, behind the gate |

`/api/files` refuses a key outside `files/`, so it cannot hand out an artwork or
a message.

## Three kinds of row

The KV key is the row id, such as `portfolio-site`. The row stores its kind.

| Kind | Needs a picture | Needs a medium | The home page draws |
|---|---|---|---|
| `image` | yes | yes | The photo, in a tile matching its orientation |
| `code` | no | no | Its own picture. With none, its snippet. With neither, a sample of its language |
| `panel` | no | no | A color block |

A code project has no medium. The upload form hides the field, and the server
stores an empty list even when one arrives.

A code tile is always square, and never smaller than two cells, so the code
stays readable.

## Every field

```jsonc
{
  "kind": "code",             // image | code | panel
  "name": "Portfolio site",   // optional. An empty name shows as untitled
  "description": "Para one.\n\nPara two.",  // a blank line starts a paragraph
  "mediums": [],              // a list of terms. Always empty on a code row
  "tags": ["javascript"],     // a list of terms
  "dateCreated": "2026-11-05",
  "galleries": [],

  // Pictures, in order. The first one is the cover, and the mosaic tile shows
  // it. The size comes from each image header on upload.
  "images": [
    { "key": "portfolio.png",   "thumb": "thumbs/portfolio.png.webp",   "width": 1600, "height": 900 },
    { "key": "portfolio-2.png", "thumb": "thumbs/portfolio-2.png.webp", "width": 900,  "height": 1600 }
  ],
  "sizeVersion": 2,

  // Code fields. Every one is optional, and an image row leaves them empty.
  "repoUrl": "https://github.com/you/project",
  "liveUrl": "https://project.example",
  "language": "javascript",   // an empty value reads a tag, then falls back to javascript
  "snippet": "...",           // up to 2000 characters, shown on the tile
  "download": {
    "key": "files/portfolio-site-notes.pdf",
    "name": "notes.pdf",
    "size": 184320,
    "type": "application/pdf"
  },

  // Panel fields. Optional, and only a panel reads them.
  "shape": "landscape",       // landscape | portrait | square
  "panelColor": 3             // 1 to 8
}
```

A url must start with `http:` or `https:`. The server drops anything else on
save.

### Limits

| Field | Limit |
|---|---|
| `images` | 12 pictures for one row |
| One file, picture or download | 25MB |
| `snippet` | 2000 characters |
| One term | 40 characters |
| `tags`, `mediums` | 24 terms each |

The cover picture takes the plain id. The rest are numbered: `piece.png`,
`piece-2.png`, `piece-3.png`.

## Terms: tags and mediums

No fixed list exists. A term is whatever you type, cleaned to one steady form
first, so `Oil Paint`, `oil paint`, and `OIL-PAINT` all become `oil-paint`.
`public/js/taxonomy.js` holds that rule, and the browser and the Worker
both import it.

| Field | Holds |
|---|---|
| `tags` | A list of terms. What the piece is about |
| `mediums` | A list of terms. What the piece is made of |

`GET /api/vocabulary` returns every term already in use, with a count, most used
first:

```json
{"tags":[{"value":"watercolor","count":3}],"mediums":[{"value":"ink","count":2}]}
```

The upload page feeds that list into a suggestion box. Type to narrow it, pick a
used term, or type a new term and press Enter. Gallery Search suggests filter
values from the same list.

Both filters also work on the API:

```
curl "http://localhost:8787/api/image-metadata?tag=watercolor"
curl "http://localhost:8787/api/image-metadata?medium=ink"
```

## Small copies

The wall never draws a tile wider than 469px, but a stored photo is three to
four times that. Each picture therefore carries a 938px WebP copy, and the wall
and the gallery cards load that copy. The detail view loads the original.

The browser makes the copy. You pick one file, and the upload page draws it small
on a canvas before sending, so both files go up in the same submit. A picture
the browser cannot read stores no copy, and `thumb` stays `null`. The wall then
loads the original.

Cloudflare resizes at the edge only for a zone you own. A `workers.dev`
subdomain has none, so the canvas does the work until a domain points here.

To fill in the copies for older rows, open `/thumbnails`. The page lists
every picture with no copy, makes one for each, and stores it. The page is
private, behind the same Access gate as the upload page. Running it twice is
safe, because a row with a copy is skipped.

## What the read path adds

A reader never sees a stored row. `/api/image-metadata` resolves each row first,
and that is where the old shapes become the current ones.

| Added field | Comes from |
|---|---|
| `id` | The KV key |
| `kind` | The stored value. Without one, a picture means `image`, and no picture means `panel` |
| `images` | The stored list, or a single `filename` promoted into a one item list |
| `tags`, `mediums` | The stored lists, or a single `medium` string promoted into a list |

| Old shape | Current shape |
|---|---|
| `medium: "ink"` | `mediums: ["ink"]` |
| `filename`, `width`, `height` | `images: [{ key, width, height }]` |
| no `kind` | A kind worked out from the fields |

No row needs rewriting in the database. A row saved again keeps only the current
shape.

Two more things happen on read:

1. A picture whose R2 object is gone is dropped from the row. An `image` row
   that loses every picture is skipped, rather than failing the whole request.
2. A missing picture size is read from the object header, and stored. The row
   carries `sizeVersion`, and `src/api/image-metadata.js` holds the current
   number. Raise that number after a fix to the size reader, and every row is
   read again.

## A contact message

A message is one JSON object under `messages/`. The prefix sits apart from the
artwork, so the gallery never sees it.

```json
{
  "name": "Someone",
  "email": "someone@example.com",
  "subject": "A commission",
  "message": "The body text.",
  "sentAt": "2026-11-06T18:20:00.000Z",
  "ip": "203.0.113.7"
}
```

| Field | Limit |
|---|---|
| `name` | 120 characters |
| `email` | 254 characters |
| `subject` | 160 characters |
| `message` | 5000 characters |

Three guards sit in front of the form:

| Guard | What it does |
|---|---|
| A honeypot field, named `website` | A crawler fills it in. The reply looks normal, and nothing is stored |
| A rate limit | Three messages a minute from one IP address |
| Length caps | The table above |

The rate limit lives in the Worker isolate, so it slows a flood rather than
stopping one. Add Cloudflare Turnstile when the form draws real traffic.

A message is stored whether or not email is set up, so nothing is lost. Read the
messages at `/messages`, behind the Access gate.

## The routes

| Route | Method | Answers with |
|---|---|---|
| `/api/image-metadata` | GET | Every row, or one row with `?id=` |
| `/api/image-metadata?tag=&medium=` | GET | The rows matching both filters |
| `/api/vocabulary` | GET | Every term in use, with a count |
| `/api/images?id=` | GET | The bytes of a picture or a small copy |
| `/api/files?key=files/...` | GET | The bytes of a project download |
| `/api/upload` | POST, DELETE | Writes or removes a row and its objects |
| `/api/thumbnail` | POST | Stores one small copy |
| `/api/messages` | GET, DELETE | Lists or removes a contact message |
| `/api/contact` | POST | Stores a message, and mails it on when email is set up |
| `/api/session` | GET | Whether this visitor holds the upload permission |

The last four of these sit behind the gate, except `/api/contact` and
`/api/session`, which are public. `src/gate.js` holds the list.

## Write a row by hand

The upload page writes an `image` row and a `code` row. Write a panel with
wrangler:

```
npx wrangler kv key put --namespace-id=<YOUR ID HERE> "first-story" \
  '{"kind":"panel","name":"A Story","mediums":["writing"],"tags":["storytelling"],"dateCreated":"2026-11-05","shape":"landscape","panelColor":3}'
```

Add `--remote` to write to the live namespace instead of the local simulator.

An `image` row needs a matching object in the bucket. Write both:

```
npx wrangler kv key put --namespace-id=<YOUR ID HERE> "test-image-1" \
  '{"kind":"image","name":"Test Piece","mediums":["watercolor"],"tags":["traditional-art"],"dateCreated":"2025-01-01","images":[{"key":"test-image-1.jpg"}]}'
npx wrangler r2 object put portfolio/test-image-1.jpg --file ./path/to/test-image.jpg
```

A row whose `images` list names an object that is not in the bucket loses that
picture on read. An `image` row with no picture left is skipped.
