// POST /api/feedback — stores a suggestion in the D1 database bound as DB.
const KINDS = ["idea", "bug", "other"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  if (body.website) return json({ ok: true }); // honeypot: bots fill hidden fields

  const message = String(body.message || "").trim().slice(0, 2000);
  if (message.length < 3) return json({ ok: false, error: "too_short" }, 400);
  const kind = KINDS.includes(body.kind) ? body.kind : "other";
  const contact = String(body.contact || "").trim().slice(0, 200) || null;
  const font = String(body.font || "").trim().slice(0, 200) || null;
  const country = (request.cf && request.cf.country) || null;
  const ua = (request.headers.get("user-agent") || "").slice(0, 300);
  const ip = request.headers.get("cf-connecting-ip") || "";
  const ipHash = ip ? (await sha256(ip + "|ou-font")).slice(0, 32) : null;

  if (ipHash) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM feedback WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    ).bind(ipHash).first();
    if (row && row.n >= 5) return json({ ok: false, error: "rate_limited" }, 429);
  }

  await env.DB.prepare(
    "INSERT INTO feedback (kind, message, contact, font, country, ua, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(kind, message, contact, font, country, ua, ipHash).run();

  return json({ ok: true });
}

export function onRequest() {
  return json({ ok: false, error: "method_not_allowed" }, 405);
}
