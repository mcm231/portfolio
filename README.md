# portfolio

## To test locally
With KV binding live:

`npx wrangler pages dev . --kv IMAGE_METADATA`

To test the KV namespace connections/get data:

`npx wrangler kv namespace list` to check the KV namespace

Put a test entry into KV:
```
npx wrangler kv key put --namespace-id=<YOUR ID HERE> "test-image-1" \
  '{"name":"Test Piece","description":"A test","medium":"watercolor","tags":["traditional-art","watercolor"],"dateCreated":"2025-01-01","galleries":["Gallery1"]}'
  ```

  Run dev server with KV bound:
  
  `npx wrangler pages dev . --kv portfolio-image-metadata`

  This spins up a local server (usually at http://localhost:8788) with your real KV namespace connected.

Hit the endpoints to verify:

All images: `curl http://localhost:8788/api/images`

By tag: `curl "http://localhost:8788/api/images?tag=watercolor"`

All tags: `curl http://localhost:8788/api/tags`

Single entry by ID: `curl "http://localhost:8788/api/images?id=test-image-1"`