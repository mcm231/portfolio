// Tells the page whether this visitor holds the upload permission.
//
// A public route. It never reveals anything a stranger could use: the answer
// is one boolean. The real gate stays in src/gate.js. A hidden menu link is a
// courtesy, never a lock.
import { identify } from '../gate.js';

export async function onRequest(context) {
  const { allowed } = await identify(context.request, context.env);

  return new Response(JSON.stringify({ allowed }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
