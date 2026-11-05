// The contact form endpoint.
//
// Every message is written to the R2 bucket under messages/, so nothing is
// ever lost. When the send_email binding exists, the message is also mailed
// on. The visitor sees the same answer either way.
//
// The bucket prefix keeps these objects away from the artwork: the gallery
// only ever reads the object named by a row's filename.

const MESSAGE_PREFIX = 'messages/';
const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_SUBJECT = 160;
const MAX_BODY = 5000;

// A soft limit, held in the isolate. It slows a flood without a new binding.
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 3;
const recent = new Map();

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// Good enough to catch a typo. The real test is whether a reply arrives.
function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function underLimit(ip, now) {
  const hits = (recent.get(ip) ?? []).filter(time => now - time < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);

  // Drop the old keys, so the map cannot grow without end.
  if (recent.size > 500) {
    for (const [key, times] of recent) {
      if (times.every(time => now - time >= RATE_WINDOW_MS)) recent.delete(key);
    }
  }

  return hits.length <= RATE_LIMIT;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Send the message as form data.' }, 400);
  }

  // A hidden field. A person leaves it empty, a crawler fills it in.
  if (String(form.get('website') || '').trim()) {
    return json({ sent: true });     // answer as normal, store nothing
  }

  const name = String(form.get('name') || '').trim().slice(0, MAX_NAME);
  const email = String(form.get('email') || '').trim().slice(0, MAX_EMAIL);
  const subject = String(form.get('subject') || '').trim().slice(0, MAX_SUBJECT);
  const body = String(form.get('message') || '').trim().slice(0, MAX_BODY);

  if (!name) return json({ error: 'Give your name.' }, 400);
  if (!looksLikeEmail(email)) return json({ error: 'Check the email address.' }, 400);
  if (!body) return json({ error: 'Write a message.' }, 400);

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  if (!underLimit(ip, now)) {
    return json({ error: 'That is a lot of messages. Try again in a minute.' }, 429);
  }

  const stamp = new Date(now).toISOString();
  const key = `${MESSAGE_PREFIX}${stamp}-${crypto.randomUUID().slice(0, 8)}.json`;
  const record = { name, email, subject, message: body, sentAt: stamp, ip };

  try {
    await env.IMAGES.put(key, JSON.stringify(record, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    });
  } catch (error) {
    console.error('Could not store the message:', error);
    return json({ error: 'The message did not go through. Try again.' }, 500);
  }

  // Mail it on, when the site is set up to send. A failure here never loses
  // the message, because it already sits in the bucket.
  let mailed = false;
  if (env.EMAIL && env.CONTACT_TO && env.CONTACT_FROM) {
    try {
      await env.EMAIL.send({
        to: env.CONTACT_TO,
        from: { email: env.CONTACT_FROM, name: 'Portfolio contact form' },
        replyTo: { email, name },
        subject: subject || `A message from ${name}`,
        text: `${name} <${email}>\n\n${body}\n`,
        html: `<p><strong>${name}</strong> &lt;${email}&gt;</p><p>${
          body.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
            .replace(/\n/g, '<br>')
        }</p>`
      });
      mailed = true;
    } catch (error) {
      console.error('Could not mail the message on:', error);
    }
  }

  return json({ sent: true, mailed }, 201);
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return new Response('Use POST.', { status: 405, headers: { Allow: 'POST' } });
}
