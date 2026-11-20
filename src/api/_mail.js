// Every mail the site sends. One file holds the provider and the from address.
//
// Cloudflare Email Routing can only send to an address the account verified,
// so it cannot answer a visitor. Resend can, and it takes one POST. The site
// ships no library for it.
//
// RESEND_API_KEY is a Worker secret, so it never enters wrangler.jsonc. Run
// `npx wrangler secret put RESEND_API_KEY` to set it. README.md holds the
// whole setup.
const ENDPOINT = 'https://api.resend.com/emails';

// True when the site can send at all. A page checks this before it offers a
// reply, and a route checks it before it tries.
export function canSend(env) {
    return Boolean(env.RESEND_API_KEY && env.CONTACT_FROM);
}

// Sends one mail. Returns { sent: true } or { sent: false, reason }.
//
// A failure here never throws, because the caller has already stored what
// matters. The message of a visitor sits in the bucket before this runs.
export async function sendMail(env, { to, subject, text, replyTo, fromName = 'Maya Malavasi' }) {
    if (!canSend(env)) return { sent: false, reason: 'Email is not set up on this site.' };
    if (!to) return { sent: false, reason: 'No address to send to.' };

    const body = {
        from: `${fromName} <${env.CONTACT_FROM}>`,
        to: [to],
        subject,
        text,
    };

    // Without this a visitor would answer the robot address. With it the
    // answer lands wherever CONTACT_FROM routes.
    if (replyTo) body.reply_to = replyTo;

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (response.ok) return { sent: true };

        const detail = await response.text();
        console.error(`The mail provider refused the send: ${response.status} ${detail}`);
        return { sent: false, reason: `The mail provider answered ${response.status}.` };
    } catch (error) {
        console.error('Could not reach the mail provider:', error);
        return { sent: false, reason: 'The mail provider did not answer.' };
    }
}
