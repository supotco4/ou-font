// POST /api/font?name=...&family=... — store a font the user chose to share.
// Only sent when the user ticks the consent box. Stored privately in D1;
// nothing here ever serves a font back.
import { json, ipHash } from "../_lib/util.js";

const MAX = 1900000; // D1 row limit is ~2 MB

function isFont(b) {
  if (b.length < 4) return false;
  const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
  return (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) || ["OTTO", "true", "wOFF", "wOF2", "ttcf"].includes(tag);
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const buf = new Uint8Array(await request.arrayBuffer());
  if (!buf.length || buf.length > MAX) return json({ ok: false, error: "size" }, 413);
  if (!isFont(buf)) return json({ ok: false, error: "type" }, 415);
  const ih = await ipHash(request);
  if (ih) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM font_uploads WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    ).bind(ih).first();
    if (row && row.n >= 20) return json({ ok: true, skipped: "rate" });
  }
  const dg = await crypto.subtle.digest("SHA-256", buf);
  const sha = [...new Uint8Array(dg)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const clip = (s, n) => (s || "").slice(0, n);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO font_uploads (name, family, size, sha256, country, ip_hash, note, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    clip(url.searchParams.get("name"), 200),
    clip(url.searchParams.get("family"), 200),
    buf.length, sha,
    (request.cf && request.cf.country) || null,
    ih,
    clip(url.searchParams.get("note"), 500),
    buf
  ).run();
  return json({ ok: true });
}
