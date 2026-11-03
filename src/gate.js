// Gate for the private routes. Every other request passes straight through.
//
// Cloudflare Access protects /upload at the edge, so an anonymous visitor sees
// the Access login page before this code runs. This gate is the second check:
// it proves the token is real, and it allows only the listed emails.
//
// It returns a Response to stop the request, or null to let it continue.
import { verifyAccessToken } from './api/_access.js';

const PROTECTED_PATHS = ['/upload', '/api/upload'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isProtected(pathname) {
  return PROTECTED_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`));
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
  const target = `https://${teamDomain}/cdn-cgi/access/login/${url.hostname}`
    + `?redirect_url=${encodeURIComponent(url.pathname + url.search)}`;
  return Response.redirect(target, 302);
}

export async function guard(request, env) {
  const url = new URL(request.url);

  if (!isProtected(url.pathname)) return null;

  // Local development only. Both conditions must hold, so the flag alone
  // cannot open the route on a deployed site.
  if (LOCAL_HOSTS.has(url.hostname) && env.ACCESS_LOCAL_BYPASS === 'true') {
    return null;
  }

  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;

  // Fail closed. An unconfigured gate must never serve the page.
  if (!teamDomain || !audience) {
    return new Response(
      'This route needs ACCESS_TEAM_DOMAIN and ACCESS_AUD. See README.md.',
      { status: 503, headers: { 'Content-Type': 'text/plain' } }
    );
  }

  let result;
  try {
    result = await verifyAccessToken(request, teamDomain, audience);
  } catch (error) {
    console.error('Access check failed:', error);
    return new Response('Access check failed.', { status: 503 });
  }

  if (!result.ok) {
    if (result.reason === 'no-token' || result.reason === 'expired') {
      return toAccessLogin(url, teamDomain);
    }
    return toHomepage(url);
  }

  const allowed = allowedEmails(env);
  if (allowed.length === 0 || !allowed.includes(result.email)) {
    console.warn(`Rejected ${url.pathname} for ${result.email}`);
    return toHomepage(url);
  }

  return null;
}
