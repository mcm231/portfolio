// The Worker. It gates the private routes, routes the API, and hands every
// other request to the static assets in public/.
import { guard } from './gate.js';
import { onRequest as imageMetadata } from './api/image-metadata.js';
import { onRequest as images } from './api/images.js';
import { onRequest as vocabulary } from './api/vocabulary.js';
import { onRequest as upload } from './api/upload.js';
import { onRequest as session } from './api/session.js';

// Each handler keeps the Pages Functions signature, so it reads context.request
// and context.env and nothing else.
const API_ROUTES = {
  '/api/image-metadata': imageMetadata,
  '/api/images': images,
  '/api/vocabulary': vocabulary,
  '/api/upload': upload,
  '/api/session': session
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const blocked = await guard(request, env);
    if (blocked) return blocked;

    const handler = API_ROUTES[url.pathname];
    if (handler) return handler({ request, env, waitUntil: ctx.waitUntil.bind(ctx) });

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  }
};
