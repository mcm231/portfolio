# portfolio

A Cloudflare Worker with static assets. `src/index.js` gates the private
routes, routes `/api/*`, and hands every other request to `public/`.

| Path                | Holds                                                 |
| ------------------- | ----------------------------------------------------- |
| `public/`           | Every file the browser downloads. The asset directory |
| `src/index.js`      | The Worker entry point and the route table            |
| `src/gate.js`       | The Cloudflare Access check for the private routes    |
| `src/api/`          | One handler for each API route                        |
| `src/repositories/` | Every read and write of KV and R2                     |
| `test/`             | The test files that `npm test` runs                   |

Nothing outside `public/` reaches the browser.

| Document                | Covers                                               |
| ----------------------- | ---------------------------------------------------- |
| `ARCHITECTURE_GUIDE.md` | Layers, imports, naming, comments, tests             |
| `DATA_MODEL.md`         | The row fields, the three kinds, the bucket prefixes |
| `STYLE_GUIDE.md`        | Color, type, space, and the look of a component      |

## Commands

| Command          | Does                                               |
| ---------------- | -------------------------------------------------- |
| `npm install`    | Installs the pinned wrangler and prettier, once    |
| `npm run dev`    | Runs the site at `http://localhost:8787`           |
| `npm run deploy` | Deploys to `portfolio.mayacollege2020.workers.dev` |
| `npm run check`  | Builds the bundle without deploying                |
| `npm test`       | Runs every test file in `test/`                    |
| `npm run format` | Formats every file with prettier                   |

`package.json` pins wrangler to one version. Two versions write incompatible
files into `.wrangler/state`, and the second one then fails to start. If that
happens, run `rm -rf .wrangler/state`. That directory holds local simulator data
only.

`wrangler.jsonc` carries the bindings and the Access variables. Git ignores it.
Copy `wrangler.example.jsonc` to start.

## Run it locally

```
npm install
npm run dev
```

Cloudflare Access does not run on localhost, so a private page needs a bypass.
Create a `.dev.vars` file:

```
ACCESS_LOCAL_BYPASS=true
```

The bypass needs two conditions: the flag and a localhost hostname. The flag
alone cannot open a route on a deployed site. Keep `.dev.vars` out of git.

Then open `http://localhost:8787/pages/upload`.

## The bindings

| Binding          | Kind          | Holds                                      |
| ---------------- | ------------- | ------------------------------------------ |
| `IMAGE_METADATA` | KV namespace  | One row for each piece of work             |
| `IMAGES`         | R2 bucket     | Artwork, small copies, downloads, messages |
| `ASSETS`         | Static assets | Everything in `public/`                    |
| `EMAIL`          | Send email    | Optional. See below                        |

Read the ids:

```
npx wrangler kv namespace list
npx wrangler r2 bucket list
```

A wrangler write goes to the local simulator by default. Add `--remote` to write
to the live namespace or bucket. `DATA_MODEL.md` holds the row shape and the
example commands that write one.

Check that the data is readable:

```
curl http://localhost:8787/api/image-metadata
curl http://localhost:8787/api/vocabulary
```

## Cloudflare Access

Four pages and three routes are private:

```
/pages/upload  /pages/edit  /pages/messages  /pages/thumbnails
/api/upload    /api/messages  /api/thumbnail
```

`src/gate.js` holds that list in `PROTECTED_PATHS`. Each path also appears in
`run_worker_first` in `wrangler.jsonc`, or the asset answers before the gate
runs.

Two checks protect each one. Cloudflare Access blocks the route at the edge and
shows the login page. Then `src/gate.js` verifies the token and checks the email
against the allow list. A signed-in person outside the list lands back on the
home page.

### Set up the application

1. Open the Cloudflare dashboard. Go to Zero Trust, then Access, then
   Applications. Add a self-hosted application.
2. Set the path to `portfolio.mayacollege2020.workers.dev/pages/upload`. Add a
   path for each private page and each private route. Use your own domain if
   you have one.
3. Add a policy of action Allow, with an Emails rule that lists your email.
4. Open the application Overview tab. Copy the Application Audience (AUD) tag.
5. Read your team domain in Zero Trust, under Settings, then Custom Pages. It
   looks like `yourteam.cloudflareaccess.com`. It carries the team name only,
   never the application name.

Check the team domain before you deploy. This must return JSON:

```
curl -s https://<team>.cloudflareaccess.com/cdn-cgi/access/certs | head -c 80
```

A 404 means the team name is wrong. An empty reply means the host does not
resolve.

### Set the variables

Put the three values in the `vars` block of `wrangler.jsonc`, then run
`npm run deploy`.

| Variable                | Example                         | Purpose                               |
| ----------------------- | ------------------------------- | ------------------------------------- |
| `ACCESS_TEAM_DOMAIN`    | `yourteam.cloudflareaccess.com` | Where the gate reads the signing keys |
| `ACCESS_AUD`            | The AUD tag from step 4         | The application the token must name   |
| `ACCESS_ALLOWED_EMAILS` | `you@example.com`               | The allow list, separated by commas   |

None of the three is a secret. The AUD tag is a public identifier, and Access
itself blocks a stranger. Git ignores `wrangler.jsonc`, so the values stay off
GitHub.

Without `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, a private route returns 503. It
never serves the page unprotected.

The dashboard accepts these variables once a deploy carries Worker code. Before
that it says _variables cannot be added to a worker that only has static
assets_.

### Confirm the deploy

```
curl -i https://portfolio.mayacollege2020.workers.dev/api/vocabulary
```

JSON means the Worker is live. HTML, or a 404, means the deploy shipped the
assets without `src/index.js`.

Then open `/pages/upload` on the deployed site. Access shows the login page.
Sign in with an email from the list.

## Email

Email needs a domain. A `workers.dev` subdomain cannot send, so this waits until
you point a domain at the site.

1. Run `npx wrangler email sending enable yourdomain.com`.
2. Add the binding to `wrangler.jsonc`: `"send_email": [{ "name": "EMAIL" }]`.
3. Add two variables: `CONTACT_TO`, your own address, and `CONTACT_FROM`, an
   address on the onboarded domain.
4. Run `npm run deploy`.

With all three in place, each contact message is also mailed to you, with the
sender set as the reply address. Without them the message is still stored in the
bucket, and the visitor sees the same answer.

## Tests

```
npm test
```

No test needs a Cloudflare login. Three of them carry the most weight:

| Test                     | Proves                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `test/access.test.mjs`   | The gate rejects a forged signature, a wrong audience, a wrong issuer, an unknown key id, an expired token, and an unlisted email        |
| `test/router.test.mjs`   | The assets serve, each API route answers, every private route stays closed, and `/api/images` refuses a key outside the artwork prefixes |
| `test/metadata.test.mjs` | A stored field survives a read, and an old row is promoted without a guessed kind                                                        |

`ARCHITECTURE_GUIDE.md` says which change needs a test.
