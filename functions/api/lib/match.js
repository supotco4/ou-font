// GET /api/lib/match?sha=<sha256 of the original upload>&family=&style=
// Finds library fonts that look like the same font: the same original file first,
// then the same family name (same style first).
import { json } from "../../_lib/util.js";

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const sha = (q.get("sha") || "").toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 64);
  const family = (q.get("family") || "").trim().toLowerCase().slice(0, 120);
  const style = (q.get("style") || "").trim().toLowerCase().slice(0, 60);
  if (!sha && !family) return json({ ok: true, items: [] });
  const { results } = await env.DB.prepare(
    `SELECT id, created_at, nickname, title, note, changes, family, style,
            (src_sha IS NOT NULL AND src_sha = ?1) AS same_file,
            (family = ?2 AND style = ?3) AS same_style
       FROM lib_fonts
      WHERE status = 'public' AND ((?1 != '' AND src_sha = ?1) OR (?2 != '' AND family = ?2))
      ORDER BY same_file DESC, same_style DESC, id DESC LIMIT 4`
  ).bind(sha, family, style).all();
  return json({ ok: true, items: results || [] });
}
