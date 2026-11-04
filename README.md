# portfolio

A Cloudflare Worker with static assets. `src/index.js` gates the private
routes, routes `/api/*`, and hands every other request to `public/`.

| Path | Holds |
|---|---|
| `public/` | Every file the browser downloads. The asset directory. |
| `src/index.js` | The Worker entry point and the route table. |
| `src/gate.js` | The Cloudflare Access check for the private routes. |
| `src/api/` | One module per API route. |
| `test/` | The gate test. |

| Command | Does |
|---|---|
| `npm install` | Installs the pinned wrangler, once |
| `npm run dev` | Runs the site at `http://localhost:8787` |
| `npm run deploy` | Deploys to `portfolio.mayacollege2020.workers.dev` |
| `npm run check` | Builds the bundle without deploying |
| `npm test` | Runs both test files |

`package.json` pins wrangler to one version. Two different versions write
incompatible files into `.wrangler/state`, and the second one then fails to
start. If that happens, run `rm -rf .wrangler/state`. The directory holds only
local simulator data, so nothing of yours lives there.

Nothing outside `public/` reaches the browser. `wrangler.jsonc` stays local,
and git ignores it.

## Image Metadata (Key-Value Database)

### To test KV Remote

Run `npm run dev`

To get the KV namespace ID, run:
```
npx wrangler kv namespace list
```

To put a test entry into Remote KV:
```
npx wrangler kv key put --namespace-id=<YOUR ID HERE> "test-image-1" \
  '{"name":"Test Piece","filename":"test-image-1.jpg","description":"A test","medium":"watercolor","tags":["traditional-art","watercolor"],"dateCreated":"2025-01-01","galleries":["Gallery1"]}' --remote
  ```

Head over to Cloudflare to watch the data being updated in real time.

### To test KV Local

With live local KV binding, run: `npm run dev`

To get the KV namespace ID, run 
```
npx wrangler kv namespace list
```

Put a test entry into Local KV:
```
npx wrangler kv key put --namespace-id=<YOUR ID HERE> "test-image-1" \
  '{"name":"Test Piece","filename":"test-image-1.jpg","description":"A test","medium":"watercolor","tags":["traditional-art","watercolor"],"dateCreated":"2025-01-01","galleries":["Gallery1"]}'
  ```

`name` and `filename` are both required on every entry. `filename` is the key of the
corresponding object in the `IMAGES` R2 bucket, used to fetch the actual image bytes.
If an entry is missing `filename`, or `filename` doesn't match any object in R2, the
API defensively skips that entry rather than failing the whole request.

Run dev server with KV bound:
```
npm run dev
```
This spins up a local server (usually at `http://localhost:8787`) with your real KV namespace connected.

Hit the endpoints to verify:
- All metadata: `curl http://localhost:8787/api/image-metadata`
- By tag: `curl "http://localhost:8787/api/image-metadata?tag=watercolor"`
- All tags: `curl http://localhost:8787/api/tags`
- Single entry by ID: `curl "http://localhost:8787/api/image-metadata?id=test-image-1"`


## Images (R2 Object Storage)

### To test R2 Remote

Run `npm run dev`

To get the R2 bucket name, run:
```
npx wrangler r2 bucket list
```

To put a test object into Remote R2 (the object key must match the `filename` field
of a KV metadata entry):
```
npx wrangler r2 object put portfolio/test-image-1.jpg --file ./path/to/test-image.jpg --remote
```

Head over to Cloudflare to watch the object appear in the bucket.

### To test R2 Local

With live local R2 binding, run: `npm run dev`

To get the R2 bucket name, run
```
npx wrangler r2 bucket list
```

Put a test object into Local R2:
```
npx wrangler r2 object put portfolio/[IMAGE NAME HERE] --file ./path/to/test-image.jpg
```

Run dev server with R2 bound:
```
npm run dev
```
This spins up a local server (usually at `http://localhost:8787`) with your real R2 bucket connected.

Hit the endpoint to verify (note: `id` here is the R2 object key, i.e. the metadata
entry's `filename`, not the KV key):
- Fetch image bytes: `curl "http://localhost:8787/api/images?id=[FILENAME HERE]" --output [FILENAME HERE]`

## Two kinds of row

The `IMAGE_METADATA` namespace holds two kinds of row. The `filename` field
decides which one a row is, and every API response states the kind.

| Kind | Has `filename` | The home page draws |
|---|---|---|
| `image` | yes | The photo, in a tile matching its orientation |
| `panel` | no | A color block, in the same grid |

A panel stands for a piece with no picture, such as a story or a program. The
colors come from `--blank-1` to `--blank-8` in `public/css/styles.css`.

### A panel row

Only `name` is needed. Two optional fields control the look:

```
npx wrangler kv key put --namespace-id=<YOUR ID HERE> "first-story" \
  '{"name":"A Story","description":"","medium":"writing","tags":["storytelling"],"dateCreated":"2026-11-04","galleries":[],"shape":"landscape","panelColor":3}'
```

| Field | Values | Effect |
|---|---|---|
| `shape` | `landscape`, `portrait`, `square` | The tile shape. Left out, the wall picks one |
| `panelColor` | 1 to 8 | The color. Left out, the wall picks one |

A panel also shows in Gallery Search, as a color card with its name and date.
Every filter still works, because a panel carries the same fields.

The upload page writes image rows only. Write a panel row with wrangler, or
with whatever you build later.

## Upload page (/upload)

`/upload` is a private page. It writes one image to the `IMAGES` R2 bucket and
one metadata entry to the `IMAGE_METADATA` KV namespace. No page on the site
links to it.

Two gates protect it:

1. Cloudflare Access blocks the route at the edge and shows the login page.
2. `functions/_middleware.js` verifies the Access token and checks the email.

A signed-in person who is not on the email list goes back to the home page.

### Set up Cloudflare Access

1. Open the Cloudflare dashboard. Go to Zero Trust, then Access, then
   Applications. Add a self-hosted application.
2. Set the path to `portfolio.mayacollege2020.workers.dev/upload`. Add a
   second path for `portfolio.mayacollege2020.workers.dev/api/upload`. Use your
   own domain instead if you have one.
3. Add a policy of action Allow, with an Emails rule that lists your email.
4. Open the application Overview tab. Copy the Application Audience (AUD) tag.
5. Read your team domain in Zero Trust, under Settings, then Custom Pages. It
   looks like `yourteam.cloudflareaccess.com`. It carries the team name only.
   It never carries the application name.

Check the team domain before you deploy. This must return JSON:

```
curl -s https://<team>.cloudflareaccess.com/cdn-cgi/access/certs | head -c 80
```

A 404 means the team name is wrong. An empty reply means the host does not
resolve.

### Set the variables

Put the three values in the `vars` block of `wrangler.jsonc`, then deploy:

```
npm run deploy
```

| Variable | Example | Purpose |
|---|---|---|
| `ACCESS_TEAM_DOMAIN` | `yourteam.cloudflareaccess.com` | Where the middleware reads the signing keys |
| `ACCESS_AUD` | the AUD tag from step 4 | The application the token must name |
| `ACCESS_ALLOWED_EMAILS` | `you@example.com` | The allow list, separated by commas |

`wrangler.jsonc` is gitignored, so the values stay off GitHub. None of the
three is a secret. The AUD tag is a public identifier, and Access itself is
what blocks a stranger.

Without `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, the route returns 503. It never
serves the page unprotected.

The dashboard works too, once a deploy carries Worker code. Before that it
says *variables cannot be added to a worker that only has static assets*.

To confirm the Worker runs in production, request a public route:

```
curl -i https://portfolio.mayacollege2020.workers.dev/api/tags
```

A JSON array means the Worker is live. HTML, or a 404, means the deploy
shipped the assets without `src/index.js`.

### Test the upload locally

Cloudflare Access does not run on localhost. Create a `.dev.vars` file:

```
ACCESS_LOCAL_BYPASS=true
```

Then run the dev server with both bindings:

```
npm run dev
```

Open `http://localhost:8787/upload`. The bypass needs two conditions: the
`ACCESS_LOCAL_BYPASS` flag and a localhost hostname. The flag alone cannot open
the route on a deployed site. Keep `.dev.vars` out of git.

### Test the gate

```
npm test
```

The first test signs real RS256 tokens with a throwaway key and runs the gate
against them. It covers a forged signature, a wrong audience, a wrong issuer,
an unknown key id, an expired token, a wrong email, and the localhost bypass.

The second test routes the Worker with stub bindings. It proves that the
assets serve, that each API route answers, and that both private routes stay
closed. Neither test needs a Cloudflare login.

### Test the upload remotely

Deploy, then open `https://<your-site>/upload`. Cloudflare Access shows the
login page. Sign in with an email from the list. An email outside the list
lands back on the home page.
