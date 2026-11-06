// GET  /api/lib/:id/comments — public comments on a library font
// POST /api/lib/:id/comments {nickname, message, kind: 'comment'|'request', letters} — links are held back
import { json, ipHash } from "../../../_lib/util.js";
import { LINKY, clean } from "../../../_lib/mod.js";

export async function onRequestGet({ params, env }) {
  const id = parseInt(params.id, 10);
  const { results } = await env.DB.prepare(
    "SELECT id, created_at, nickname, message, kind, letters FROM lib_comments WHERE font_id = ? AND status = 'public' ORDER BY id ASC LIMIT 200"
  ).bind(id).all();
  return json({ ok: true, items: results || [] });
}

export async function onRequestPost({ params, request, env }) {
  const id = parseInt(params.id, 10);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400); }
  if (body.website) return json({ ok: true, held: true }); // honeypot
  const nickname = clean(body.nickname, 40);
  const message = String(body.message || "").trim().slice(0, 1000);
  const kind = body.kind === "request" ? "request" : "comment";
  const letters = kind === "request" ? [...String(body.letters || "").replace(/[\s,;]+/g, "")].slice(0, 12).join("") : null;
  if (nickname.length < 2) return json({ ok: false, error: "nickname" }, 400);
  if (message.length < 2) return json({ ok: false, error: "too_short" }, 400);
  const f = await env.DB.prepare("SELECT id FROM lib_fonts WHERE id = ? AND status = 'public'").bind(id).first();
  if (!f) return json({ ok: false, error: "not_found" }, 404);
  const ih = await ipHash(request);
  if (ih) {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM lib_comments WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
    ).bind(ih).first();
    if (row && row.n >= 10) return json({ ok: false, error: "rate_limited" }, 429);
  }
  const status = [nickname, message].some((t) => LINKY.test(t)) ? "held" : "public";
  const res = await env.DB.prepare(
    "INSERT INTO lib_comments (font_id, nickname, message, ip_hash, status, kind, letters) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, nickname, message, ih, status, kind, letters).run();
  return json({ ok: true, held: status !== "public", id: res.meta && res.meta.last_row_id });
}
