// POST /api/lib/report {kind: 'font'|'comment', id} — 3 different people hide it
import { json, ipHash } from "../../_lib/util.js";

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400); }
  const kind = body.kind === "comment" ? "comment" : "font";
  const id = parseInt(body.id, 10);
  if (!id) return json({ ok: false, error: "bad_request" }, 400);
  const ih = (await ipHash(request)) || "anon";
  await env.DB.prepare("INSERT OR IGNORE INTO lib_reports (kind, target_id, ip_hash) VALUES (?, ?, ?)").bind(kind, id, ih).run();
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM lib_reports WHERE kind = ? AND target_id = ?").bind(kind, id).first();
  if (row && row.n >= 3) {
    const table = kind === "comment" ? "lib_comments" : "lib_fonts";
    await env.DB.prepare(`UPDATE ${table} SET status = 'hidden' WHERE id = ? AND status = 'public'`).bind(id).run();
  }
  return json({ ok: true });
}
