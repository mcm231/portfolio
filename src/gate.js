// Gate for the private routes. Every other request passes straight through.
//
// Cloudflare Access protects /upload at the edge, so an anonymous visitor sees
// the Access login page before this code runs. This gate is the second check:
// it proves the token is real, and it allows only the listed emails.
//
// It returns a Response to stop the request, or null to let it continue.
import { verifyAccessToken } from './api/_access.js';

// Every private page and every private route, behind one rule. A path here
// must also appear in run_worker_first in wrangler.jsonc, or the asset would
// answer before this file runs.
const PROTECTED_PATHS = [
    '/pages/upload',
    '/pages/edit',
    '/pages/messages',
    '/pages/thumbnails',
    '/api/upload',
    '/api/messages',
    '/api/thumbnail',
];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// A page answers on three spellings: the plain path, a path under it, and the
// file name itself. All three are protected, so no spelling walks around the
// gate.
export function isProtected(pathname) {
    return PROTECTED_PATHS.some(
        path => pathname === path || pathname === `${path}.html` || pathname.startsWith(`${path}/`)
    );
}

function allowedEmails(env) {
    return (env.ACCESS_ALLOWED_EMAILS || '')
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(Boolean);
}

function toHomepage(url) {
    return Response.redirect(new URL('/', url).toString(), 302);
}

function toAccessLogin(url, teamDomain) {
    const target =
        `https://${teamDomain}/cdn-cgi/access/login/${url.hostname}` +
        `?redirect_url=${encodeURIComponent(url.pathname + url.search)}`;
    return Response.redirect(target, 302);
}

// Who is asking, without deciding what to do about it. Any route may call
// this, including a public one, because the Access cookie travels with every
// request to the host once the person signs in.
//
// Returns { allowed, reason, email }.
export async function identify(request, env) {
    const url = new URL(request.url);

    // Local development only. Both conditions must hold, so the flag alone
    // cannot open a route on a deployed site.
    if (LOCAL_HOSTS.has(url.hostname) && env.ACCESS_LOCAL_BYPASS === 'true') {
        return { allowed: true, reason: 'local-bypass' };
    }

    const teamDomain = env.ACCESS_TEAM_DOMAIN;
    const audience = env.ACCESS_AUD;

    // Fail closed. An unconfigured gate must never open a route.
    if (!teamDomain || !audience) return { allowed: false, reason: 'not-configured' };

    let result;
    try {
        result = await verifyAccessToken(request, teamDomain, audience);
    } catch (error) {
        console.error('Access check failed:', error);
        return { allowed: false, reason: 'check-failed' };
    }

    if (!result.ok) return { allowed: false, reason: result.reason };

    const allowed = allowedEmails(env);
    if (allowed.length === 0 || !allowed.includes(result.email)) {
        return { allowed: false, reason: 'not-listed', email: result.email };
    }

    return { allowed: true, reason: 'ok', email: result.email };
}

export async function guard(request, env) {
    const url = new URL(request.url);

    if (!isProtected(url.pathname)) return null;

    const who = await identify(request, env);
    if (who.allowed) return null;

    switch (who.reason) {
        case 'not-configured':
            return new Response(
                'This route needs ACCESS_TEAM_DOMAIN and ACCESS_AUD. See README.md.',
                { status: 503, headers: { 'Content-Type': 'text/plain' } }
            );

        case 'check-failed':
            return new Response('Access check failed.', { status: 503 });

        // No token yet, or an old one. Send the person to sign in.
        case 'no-token':
        case 'expired':
            return toAccessLogin(url, env.ACCESS_TEAM_DOMAIN);

        default:
            console.warn(`Rejected ${url.pathname}: ${who.reason} ${who.email || ''}`);
            return toHomepage(url);
    }
}
