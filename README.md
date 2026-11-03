# portfolio

## Image Metadata (Key-Value Database)

### To test KV Remote

Run `npx wrangler pages dev .`

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

With live local KV binding, run: `npx wrangler pages dev . --kv IMAGE_METADATA`

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
npx wrangler pages dev . --kv portfolio-image-metadata
```
This spins up a local server (usually at `http://localhost:8788`) with your real KV namespace connected.

Hit the endpoints to verify:
- All metadata: `curl http://localhost:8788/api/image-metadata`
- By tag: `curl "http://localhost:8788/api/image-metadata?tag=watercolor"`
- All tags: `curl http://localhost:8788/api/tags`
- Single entry by ID: `curl "http://localhost:8788/api/image-metadata?id=test-image-1"`


## Images (R2 Object Storage)

### To test R2 Remote

Run `npx wrangler pages dev .`

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

With live local R2 binding, run: `npx wrangler pages dev . --r2 IMAGES`

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
npx wrangler pages dev . --r2 IMAGES
```
This spins up a local server (usually at `http://localhost:8788`) with your real R2 bucket connected.

Hit the endpoint to verify (note: `id` here is the R2 object key, i.e. the metadata
entry's `filename`, not the KV key):
- Fetch image bytes: `curl "http://localhost:8788/api/images?id=[FILENAME HERE]" --output [FILENAME HERE]`

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
2. Set the path to `portfolio.pages.dev/upload` and add a second path for
   `portfolio.pages.dev/api/upload`. Use your own domain if you have one.
3. Add a policy of action Allow, with an Emails rule that lists your email.
4. Open the application Overview tab. Copy the Application Audience (AUD) tag.
5. Note your team domain. It looks like `yourteam.cloudflareaccess.com`.

### Set the variables

Add these in the dashboard, under Workers and Pages, your project, Settings,
Variables and Secrets:

| Variable | Example | Purpose |
|---|---|---|
| `ACCESS_TEAM_DOMAIN` | `yourteam.cloudflareaccess.com` | Where the middleware reads the signing keys |
| `ACCESS_AUD` | the AUD tag from step 4 | The application the token must name |
| `ACCESS_ALLOWED_EMAILS` | `you@example.com` | The allow list, separated by commas |

Without `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, the route returns 503. It never
serves the page unprotected.

### Test the upload locally

Cloudflare Access does not run on localhost. Create a `.dev.vars` file:

```
ACCESS_LOCAL_BYPASS=true
```

Then run the dev server with both bindings:

```
npx wrangler pages dev . --kv IMAGE_METADATA --r2 IMAGES
```

Open `http://localhost:8788/upload`. The bypass needs two conditions: the
`ACCESS_LOCAL_BYPASS` flag and a localhost hostname. The flag alone cannot open
the route on a deployed site. Keep `.dev.vars` out of git.

### Test the gate

```
node test/access.test.mjs
```

The test signs real RS256 tokens with a throwaway key and runs the middleware
against them. It covers a forged signature, a wrong audience, a wrong issuer,
an unknown key id, an expired token, a wrong email, and the localhost bypass.

### Test the upload remotely

Deploy, then open `https://<your-site>/upload`. Cloudflare Access shows the
login page. Sign in with an email from the list. An email outside the list
lands back on the home page.
