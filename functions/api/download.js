// POST /api/download — count one download.
// The total is private: it is only read from the D1 database, never served.
import { json, ipHash } from "../_lib/util.js";

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch {}
  const ext = ["ttf", "otf"].includes(body.ext) ? body.ext : null;
  const country = (request.cf && request.cf.country) || null;
  const ih = await ipHash(request);
  if (ih) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM downloads WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    ).bind(ih).first();
    if (row && row.n >= 30) return json({ ok: true });
  }
  await env.DB.prepare("INSERT INTO downloads (ext, country, ip_hash) VALUES (?, ?, ?)").bind(ext, country, ih).run();
  return json({ ok: true });
}
