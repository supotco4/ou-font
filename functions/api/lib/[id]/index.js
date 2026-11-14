// PATCH  /api/lib/:id {title?, note?}  — the uploader (x-owner-key) edits their font's text
// DELETE /api/lib/:id                  — the uploader takes their font off the library
import { json, ownsFont, isAdmin } from "../../../_lib/util.js";
import { LINKY, clean } from "../../../_lib/mod.js";

export async function onRequestPatch({ request, env, params }) {
  const id = parseInt(params.id, 10);
  if (!id || !((await ownsFont(request, env, id)) || (await isAdmin(request, env)))) return json({ ok: false, error: "forbidden" }, 403);
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400); }
  const title = b.title != null ? clean(b.title, 120) : null;
  const note = b.note != null ? clean(b.note, 600) : null;
  if (title !== null && title.length < 2) return json({ ok: false, error: "title" }, 400);
  const held = [title, note].some((t) => t && LINKY.test(t));
  await env.DB.prepare(
    `UPDATE lib_fonts SET title = COALESCE(?, title), note = COALESCE(?, note), updated_at = datetime('now'),
            status = CASE WHEN ? THEN 'held' ELSE status END WHERE id = ?`
  ).bind(title, note, held ? 1 : 0, id).run();
  return json({ ok: true, held });
}

export async function onRequestDelete({ request, env, params }) {
  const id = parseInt(params.id, 10);
  if (!id || !((await ownsFont(request, env, id)) || (await isAdmin(request, env)))) return json({ ok: false, error: "forbidden" }, 403);
  await env.DB.prepare("UPDATE lib_fonts SET status = 'removed' WHERE id = ?").bind(id).run();
  return json({ ok: true });
}
