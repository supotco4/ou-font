// GET  /api/lib — the public font library (no font data, no IPs)
// POST /api/lib {nickname, title, note, changes, license: true, font: base64 WOFF}
import { json, ipHash } from "../../_lib/util.js";
import { LINKY, clean } from "../../_lib/mod.js";

const MAX = 1900000;

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    `SELECT f.id, f.created_at, f.nickname, f.title, f.note, f.changes, f.size,
            (SELECT COUNT(*) FROM lib_comments c WHERE c.font_id = f.id AND c.status = 'public' AND COALESCE(c.kind, 'comment') = 'comment') AS comments,
            (SELECT COUNT(*) FROM lib_comments c WHERE c.font_id = f.id AND c.status = 'public' AND c.kind = 'request') AS requests
       FROM lib_fonts f WHERE f.status = 'public' ORDER BY f.id DESC LIMIT 200`
  ).all();
  return json({ ok: true, items: results || [] });
}

export async function onRequestPost({ request, env }) {
  if (+(request.headers.get("content-length") || 0) > MAX * 1.4 + 60000) return json({ ok: false, error: "size" }, 413);
  let q;
  try { q = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400); }
  if (q.license !== true) return json({ ok: false, error: "license" }, 400);
  const nickname = clean(q.nickname, 40);
  if (nickname.length < 2) return json({ ok: false, error: "nickname" }, 400);
  const title = clean(q.title, 120);
  const note = clean(q.note, 600);
  const srcSha = String(q.src_sha || "").toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 64) || null;
  const family = clean(q.family, 120).toLowerCase() || null;
  const style = clean(q.style, 60).toLowerCase() || null;
  let changes = "{}";
  try { changes = JSON.stringify(q.changes || {}); if (changes.length > 40000) changes = "{}"; } catch { changes = "{}"; }

  let buf;
  try { const bin = atob(String(q.font || "")); buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); }
  catch { return json({ ok: false, error: "bad_request" }, 400); }
  if (!buf.length || buf.length > MAX) return json({ ok: false, error: "size" }, 413);
  const tag = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
  if (tag !== "wOFF" && tag !== "wOF2") return json({ ok: false, error: "type" }, 415);

  const ih = await ipHash(request);
  if (ih) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM lib_fonts WHERE ip_hash = ? AND created_at > datetime('now', '-1 day')"
    ).bind(ih).first();
    if (row && row.n >= 10) return json({ ok: false, error: "rate_limited" }, 429);
  }
  const dg = await crypto.subtle.digest("SHA-256", buf);
  const sha = [...new Uint8Array(dg)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const dup = await env.DB.prepare("SELECT id FROM lib_fonts WHERE sha256 = ?").bind(sha).first();
  if (dup) return json({ ok: true, id: dup.id, duplicate: true });

  const status = [nickname, title, note].some((t) => t && LINKY.test(t)) ? "held" : "public";
  const res = await env.DB.prepare(
    "INSERT INTO lib_fonts (nickname, title, note, changes, size, sha256, country, ip_hash, status, data, src_sha, family, style) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(nickname, title, note, changes, buf.length, sha, (request.cf && request.cf.country) || null, ih, status, buf.buffer, srcSha, family, style).run();
  return json({ ok: true, id: res.meta && res.meta.last_row_id, held: status !== "public" });
}
