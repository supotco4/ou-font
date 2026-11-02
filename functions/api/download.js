// GET  /api/download — total number of fonts downloaded
// POST /api/download — count one download
import { json, ipHash } from "../_lib/util.js";

async function total(env) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM downloads").first();
  return (row && row.n) || 0;
}

export async function onRequestGet({ env }) {
  return json({ ok: true, total: await total(env) });
}

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
    if (row && row.n >= 30) return json({ ok: true, total: await total(env), skipped: true });
  }
  await env.DB.prepare("INSERT INTO downloads (ext, country, ip_hash) VALUES (?, ?, ?)").bind(ext, country, ih).run();
  return json({ ok: true, total: await total(env) });
}
