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
  '{"name":"Test Piece","description":"A test","medium":"watercolor","tags":["traditional-art","watercolor"],"dateCreated":"2025-01-01","galleries":["Gallery1"]}' --remote
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
  '{"name":"Test Piece","description":"A test","medium":"watercolor","tags":["traditional-art","watercolor"],"dateCreated":"2025-01-01","galleries":["Gallery1"]}'
  ```

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

To put a test object into Remote R2:
```
npx wrangler r2 object put portfolio/test-image-1 --file ./path/to/test-image.jpg --remote
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

Hit the endpoint to verify:
- Fetch image bytes by ID: `curl "http://localhost:8788/api/images?id=[IMAGE NAME HERE]" --output [IMAGE NAME HERE].jpg`
