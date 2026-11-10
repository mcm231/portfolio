# Architecture guide

Rules for the code cleanliness, architecture, and organization of this site.
`STYLE_GUIDE.md` owns the look. This file owns the shape.

The code follows every rule below. Keep it that way in a file you add, and in
a file you change.

## Where a document ends

A fact lives in one file. Link to it. Never repeat it.

| File                    | Owns                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| `README.md`             | Install, run, deploy, and the Cloudflare Access setup            |
| `ARCHITECTURE_GUIDE.md` | Layers, imports, naming, comments, tests                         |
| `DATA_MODEL.md`         | The row fields, the three kinds, the prefixes, the legacy shapes |
| `STYLE_GUIDE.md`        | Color, type, space, and the look of a component                  |

A document that names a file must name a file that exists. Fix the document in
the same commit that moves the code.

## The layers

### The back end

| Layer       | Lives in                | Owns                                        |
| ----------- | ----------------------- | ------------------------------------------- |
| Entry       | `src/index.js`          | The route table and the asset fallback      |
| Gate        | `src/gate.js`           | Who may reach a private path                |
| Route       | `src/api/*.js`          | One request: read it, check it, answer it   |
| Reply       | `src/api/_reply.js`     | Every status code and every response header |
| Repository  | `src/repositories/*.js` | KV and R2. Every key and every prefix       |
| Shared rule | `public/js/shared/*.js` | A rule both sides apply                     |

### The front end

| Layer       | Lives in                | Owns                    |
| ----------- | ----------------------- | ----------------------- |
| Page        | `public/pages/*.html`   | The markup of one page  |
| Page script | `public/js/<page>.js`   | The DOM of one page     |
| Component   | `public/js/*.js`        | One reusable behavior   |
| Client      | `public/js/api.js`      | Every call to `/api/*`  |
| Shared rule | `public/js/shared/*.js` | A rule both sides apply |
| Style       | `public/css/*.css`      | The look                |

### One direction

```
entry        -> route -> repository -> binding
route        -> reply, shared rule
page script  -> component, client, shared rule
component    -> shared rule
shared rule  -> nothing
```

1. Only a repository names `env.IMAGE_METADATA` or `env.IMAGES`. `src/index.js`
   names `env.ASSETS`, and nothing else does.
2. A repository never reads a request, and never returns a `Response`.
3. A shared rule imports nothing. It touches no DOM, no `fetch`, no binding.
4. A component never calls `document.getElementById`. It takes its elements as
   arguments.
5. A page script never writes an API url. It calls `js/api.js`.
6. Nothing imports a page script.

## The back end

### A route file

A route file exports one function for each method it answers. The name says the
work, not the method. `src/index.js` maps a path and a method to that function.

```js
// src/index.js
const ROUTES = {
    '/api/messages': { GET: listMessages, DELETE: deleteMessage },
};
```

A handler takes `(request, env, ctx)`. It does four things, in this order:

1. Read the request.
2. Check the values.
3. Call a repository.
4. Return a reply.

Nothing else belongs in a handler. Move an algorithm to a shared rule, and move
a key or a prefix to a repository.

### Replies

`src/api/_reply.js` owns `json`, `badRequest`, `notFound`, and `serverError`. A
route never builds a header set, and never writes a status code by hand.

### Validation

The handler checks. The repository trusts.

1. The browser cleans a value for the person who types it.
2. The handler cleans the same value again, with the same shared rule module. A
   direct POST must never skip a check.
3. A bad value returns `badRequest` with one sentence. Nothing is stored.
4. A route that takes an object key from a visitor checks the prefix first.
5. A repository stores what it is given.

### Repositories

One file for each stored thing. Export one object, named for the file.

| Repository          | Owns                                                      |
| ------------------- | --------------------------------------------------------- |
| `rowRepository`     | The `IMAGE_METADATA` namespace, and the legacy promotions |
| `imageRepository`   | An artwork object, a `thumbs/` copy, a `files/` download  |
| `messageRepository` | The `messages/` prefix                                    |

A method reads as `get`, `put`, `list`, or `delete`. A prefix string appears in
exactly one file, the repository that owns it.

### A helper in src/api

A file in `src/api/` that is not a route starts with an underscore: `_reply.js`,
`_access.js`, `_image-size.js`.

### The gate

`src/gate.js` holds every private path in `PROTECTED_PATHS`. Each path there
also appears in `run_worker_first` in `wrangler.jsonc`, or the asset answers
before the gate runs.

The gate fails closed. An unconfigured gate returns 503, and never the page.

`identify` reports who is asking. `guard` decides what to do. A public route may
call `identify`, and a hidden menu link is a courtesy, never a lock.

## The front end

### Where a page lives

`public/index.html` is the home page. Every other page lives in
`public/pages/`. The file name is the url.

| File                       | Url             |
| -------------------------- | --------------- |
| `public/index.html`        | `/`             |
| `public/pages/about.html`  | `/pages/about`  |
| `public/pages/upload.html` | `/pages/upload` |

A private page sits beside a public one. The gate keeps it private, not the
folder.

### The structure of a page

Every page carries a body class that names the page, and one `<main>`. Page CSS
scopes to that body class.

A reading page splits into numbered sections:

```html
<body class="about">
    <main class="about-page">
        <header class="hero">...</header>
        <section class="section">
            <p class="section-number">01</p>
            <h2 class="section-heading">[ Section heading ]</h2>
        </section>
    </main>
</body>
```

Three pages do not split that way, and each one is named here:

| Page                     | Pattern                          |
| ------------------------ | -------------------------------- |
| `about`, `contact`       | Numbered sections                |
| `index`                  | An exception. The pannable plane |
| `upload`, `edit`         | An exception. One form           |
| `messages`, `thumbnails` | An exception. One tool           |

To add an exception, add the page to this table first.

### One script for one page

A page loads one page script, named for the page. The script imports the
components it needs. It never reads a module off `window`.

| Page                 | Script          |
| -------------------- | --------------- |
| `index.html`         | `js/home.js`    |
| `pages/gallery.html` | `js/gallery.js` |
| `pages/edit.html`    | `js/edit.js`    |
| `pages/upload.html`  | `js/upload.js`  |

`index.html` is the home page, so its script is `home.js`. Every other page
takes the name of its file.

### Components

A component exports a factory or a render function. It takes its elements and
its data as arguments, and it returns a value or a handle.

| Module            | Exports                       |
| ----------------- | ----------------------------- |
| `pan.js`          | `createPan`                   |
| `term-field.js`   | `createTermField`             |
| `mosaic.js`       | `renderMosaic`                |
| `code-tile.js`    | `buildCodeBlock`              |
| `gallery-page.js` | `mountGallery`, `GalleryPage` |

A behavior that two pages use becomes a component. A behavior that one page uses
stays in the page script until a second page needs it.

### The API client

`public/js/api.js` holds every url, every `fetch`, and every status check. One
file changes when a route changes.

### A shared rule

`public/js/shared/` holds a rule that the browser and the Worker both apply. The
browser loads the file over HTTP. The Worker imports the same file at build
time, so the two can never drift apart.

| Module                | Holds                                |
| --------------------- | ------------------------------------ |
| `shared/taxonomy.js`  | A term, a medium, a language         |
| `shared/row.js`       | Reading one row                      |
| `shared/id-rules.js`  | A slug and a free id                 |
| `shared/thumbnail.js` | The size and the key of a small copy |

Never copy one of these rules into a second file.

### Libraries

The site ships no runtime dependency. One exception exists, and it is named
here:

| Exception            | Where                       | Why                                   |
| -------------------- | --------------------------- | ------------------------------------- |
| React 18, from unpkg | `public/pages/gallery.html` | A filter list that redraws from state |

To add a library, add a row to this table first.

### CSS files

| File                 | Holds                                                 |
| -------------------- | ----------------------------------------------------- |
| `css/tokens.css`     | `:root`. The only file with a raw value               |
| `css/base.css`       | Reset, buttons, the page shell, the forms, the menu   |
| `css/components.css` | A chip, a code tile, a caption, a placeholder, a hero |
| `css/home.css`       | The pannable plane and the photo wall                 |
| `css/gallery.css`    | The grid, its detail view, its modal                  |
| `css/upload.css`     | The upload form                                       |
| `css/about.css`      | The about page                                        |
| `css/contact.css`    | The contact page                                      |
| `css/messages.css`   | The contact inbox                                     |

A page links tokens, base, and components, then its own file. A rule used by
two pages belongs in base or components, never in two page files.

## Names

| Thing           | Form                    | Example                             |
| --------------- | ----------------------- | ----------------------------------- |
| A file          | kebab-case              | `code-tile.js`                      |
| A page script   | The page name           | `pages/upload.html`, `js/upload.js` |
| A repository    | `<thing>Repository.js`  | `rowRepository.js`                  |
| A server helper | A leading underscore    | `_reply.js`, `_image-size.js`       |
| A test          | `<subject>.test.mjs`    | `router.test.mjs`                   |
| A function      | camelCase, a verb first | `readImages`                        |
| A factory       | `create<Thing>`         | `createTermField`                   |
| A constant      | UPPER_SNAKE             | `THUMB_WIDTH`                       |
| A CSS class     | kebab-case              | `.message-card`                     |

One thing carries one name across the whole site. `DATA_MODEL.md` names the
things.

## Comments

Every file opens with a block. It says what the file owns, and why the file
exists.

```js
// Drag-to-pan controller for one plane element.
//
// It owns the pan offset, the inertia glide, and the recenter ease. It never
// touches the DOM itself: every frame it calls onChange(pan) and lets the
// caller decide what to move.
```

An inline comment says why. It explains a decision, a bound, or a boundary:

```js
const FRICTION = 0.94; // velocity kept per frame during the glide
```

A comment that repeats the next line is deleted:

```js
const url = new URL(request.url); // make a URL
```

## Formatting

`.editorconfig` and `.prettierrc` decide. Run `npm run format` before a commit.

| Setting         | Value   |
| --------------- | ------- |
| `tabWidth`      | 4       |
| `printWidth`    | 100     |
| `singleQuote`   | true    |
| `semi`          | true    |
| `trailingComma` | `es5`   |
| `arrowParens`   | `avoid` |

`npm run format:check` reports a file that drifted. Prettier settles every
formatting question, so a review can skip them.

## Tests

`test/` holds plain node scripts. `npm test` runs them in order. One subject for
one file, named `<subject>.test.mjs`. A new file goes into the `test` script in
`package.json`.

A test is required for:

| Change                       | Test                               |
| ---------------------------- | ---------------------------------- |
| A new `/api` route           | An entry in `test/router.test.mjs` |
| A shared rule module         | Its own file                       |
| A gate rule or a prefix rule | `test/access.test.mjs`             |
| A repository read or write   | `test/metadata.test.mjs`           |
| A new color pair             | `test/contrast.test.mjs`           |

No test is required for page wiring, CSS, or markup.
