// POST /api/report {id} — flag a post; 3 different people hide it automatically
import { json, ipHash } from "../_lib/util.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }
  const id = parseInt(body.id, 10);
  if (!id) return json({ ok: false, error: "bad_request" }, 400);
  const ih = (await ipHash(request)) || "anon";
  await env.DB.prepare("INSERT OR IGNORE INTO reports (feedback_id, ip_hash) VALUES (?, ?)").bind(id, ih).run();
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM reports WHERE feedback_id = ?").bind(id).first();
  if (row && row.n >= 3) {
    await env.DB.prepare("UPDATE feedback SET status = 'hidden' WHERE id = ? AND status = 'public'").bind(id).run();
  }
  return json({ ok: true });
}
