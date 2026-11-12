// The Worker. It gates the private routes, routes the API, and hands every
// other request to the static assets in public/.
import { guard } from './gate.js';
import { methodNotAllowed } from './api/_reply.js';
import { readRows } from './api/image-metadata.js';
import { readImage } from './api/images.js';
import { readFile } from './api/files.js';
import { readVocabulary } from './api/vocabulary.js';
import { saveRow, deleteRow } from './api/upload.js';
import { readSession } from './api/session.js';
import { sendMessage } from './api/contact.js';
import { listMessages, deleteMessage } from './api/messages.js';
import { saveThumbnail } from './api/thumbnail.js';

// One path, one method, one handler. A handler takes (request, env, ctx) and
// nothing else. A method missing here answers 405.
const ROUTES = {
    '/api/image-metadata': { GET: readRows },
    '/api/images': { GET: readImage, HEAD: readImage },
    '/api/files': { GET: readFile, HEAD: readFile },
    '/api/vocabulary': { GET: readVocabulary },
    '/api/upload': { POST: saveRow, DELETE: deleteRow },
    '/api/session': { GET: readSession },
    '/api/contact': { POST: sendMessage },
    '/api/messages': { GET: listMessages, DELETE: deleteMessage },
    '/api/thumbnail': { POST: saveThumbnail },
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        const blocked = await guard(request, env);
        if (blocked) return blocked;

        const route = ROUTES[url.pathname];

        if (route) {
            const handler = route[request.method];
            if (!handler) return methodNotAllowed(Object.keys(route));
            return handler(request, env, ctx);
        }

        if (url.pathname.startsWith('/api/')) {
            return new Response('Not found', { status: 404 });
        }

        return env.ASSETS.fetch(request);
    },
};
