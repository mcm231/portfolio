// Cloudflare Access JWT verification.
//
// Access puts a signed token on every request it lets through, in the
// Cf-Access-Jwt-Assertion header and the CF_Authorization cookie. This module
// checks the signature, the audience, the issuer, and the expiry, then returns
// the email of the person who signed in.

const CERTS_TTL_MS = 60 * 60 * 1000;

// Cached per isolate. A cold start fetches the certs again.
let certCache = { teamDomain: null, keys: null, fetchedAt: 0 };

function base64UrlToBytes(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function decodeJson(part) {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

async function loadKeys(teamDomain, now) {
    const fresh =
        certCache.teamDomain === teamDomain &&
        certCache.keys &&
        now - certCache.fetchedAt < CERTS_TTL_MS;
    if (fresh) return certCache.keys;

    const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
    if (!response.ok) throw new Error(`Access certs request failed: ${response.status}`);

    const { keys = [] } = await response.json();
    const imported = new Map();

    for (const jwk of keys) {
        const key = await crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify']
        );
        imported.set(jwk.kid, key);
    }

    certCache = { teamDomain, keys: imported, fetchedAt: now };
    return imported;
}

function readToken(request) {
    const header = request.headers.get('Cf-Access-Jwt-Assertion');
    if (header) return header;

    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
    return match ? match[1] : null;
}

// Returns { ok: true, email } or { ok: false, reason }.
export async function verifyAccessToken(request, teamDomain, audience) {
    const token = readToken(request);
    if (!token) return { ok: false, reason: 'no-token' };

    const parts = token.split('.');
    if (parts.length !== 3) return { ok: false, reason: 'malformed-token' };

    let header;
    let payload;
    try {
        header = decodeJson(parts[0]);
        payload = decodeJson(parts[1]);
    } catch {
        return { ok: false, reason: 'malformed-token' };
    }

    const now = Date.now();
    const keys = await loadKeys(teamDomain, now);
    const key = keys.get(header.kid);
    if (!key) return { ok: false, reason: 'unknown-key' };

    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const valid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        base64UrlToBytes(parts[2]),
        signed
    );
    if (!valid) return { ok: false, reason: 'bad-signature' };

    if (payload.iss !== `https://${teamDomain}`) return { ok: false, reason: 'bad-issuer' };

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(audience)) return { ok: false, reason: 'bad-audience' };

    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) {
        return { ok: false, reason: 'expired' };
    }

    return { ok: true, email: (payload.email || '').toLowerCase() };
}
