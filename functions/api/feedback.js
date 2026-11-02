// GET  /api/feedback  — latest public suggestions (no contact details)
// POST /api/feedback  — add a suggestion; posts with links are held back
import { json, ipHash } from "../_lib/util.js";

const KINDS = ["idea", "bug", "other"];
const LINKY = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ru|xyz|top|io|me|info|biz|link|click|site|online|shop)\b|t\.me\/|bit\.ly)/i;

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id, created_at, kind, message, font, reply, nickname FROM feedback WHERE status = 'public' ORDER BY id DESC LIMIT 50"
  ).all();
  return json({ ok: true, items: results || [] });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  if (body.website) return json({ ok: true, held: true }); // honeypot

  const message = String(body.message || "").trim().slice(0, 2000);
  if (message.length < 3) return json({ ok: false, error: "too_short" }, 400);
  const kind = KINDS.includes(body.kind) ? body.kind : "other";
  const nickname = String(body.nickname || "").replace(/\s+/g, " ").trim().slice(0, 40) || null;
  const font = String(body.font || "").trim().slice(0, 120) || null;
  const country = (request.cf && request.cf.country) || null;
  const ua = (request.headers.get("user-agent") || "").slice(0, 300);
  const ih = await ipHash(request);

  if (ih) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM feedback WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    ).bind(ih).first();
    if (row && row.n >= 5) return json({ ok: false, error: "rate_limited" }, 429);
  }

  const status = [message, font, nickname].some((t) => t && LINKY.test(t)) ? "held" : "public";
  const res = await env.DB.prepare(
    "INSERT INTO feedback (kind, message, nickname, font, country, ua, ip_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(kind, message, nickname, font, country, ua, ih, status).run();

  return json({ ok: true, held: status !== "public", id: res.meta && res.meta.last_row_id });
}
