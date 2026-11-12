// Tells a page whether this visitor holds the upload permission.
//
// A public route. The answer is one boolean, and it reveals nothing a stranger
// could use. The real check stays in src/gate.js, because a hidden menu link
// only tidies the menu. It restricts nothing.
import { identify } from '../gate.js';
import { json } from './_reply.js';

export async function readSession(request, env) {
    const { allowed } = await identify(request, env);
    return json({ allowed });
}
