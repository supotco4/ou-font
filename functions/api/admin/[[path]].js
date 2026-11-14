// The site owner's moderation API. Every call needs the x-admin-key header.
// GET  /api/admin/stats     downloads per day, totals
// GET  /api/admin/fonts     every library font, any status
// GET  /api/admin/comments  every comment / request, any status
// GET  /api/admin/feedback  every suggestion, any status
// POST /api/admin/replace   {id, font: base64 WOFF, edited?}
// POST /api/admin/action    {kind: font|comment|feedback, id, action: hide|show|delete}
import { json, isAdmin } from "../../_lib/util.js";

const TABLES = { font: "lib_fonts", comment: "lib_comments", feedback: "feedback" };

export async function onRequest({ request, env, params }) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "forbidden" }, 403);
  const what = (params.path || [])[0] || "";
  const db = env.DB;
  if (request.method === "GET") {
    if (what === "stats") {
      const days = await db.prepare(
        `SELECT date(created_at, '+9 hours') AS d, COUNT(*) AS n, COUNT(DISTINCT ip_hash) AS people, SUM(ext = 'belen') AS belen
           FROM downloads GROUP BY d ORDER BY d DESC LIMIT 60`).all();
      const tot = await db.prepare("SELECT COUNT(*) AS n, COUNT(DISTINCT ip_hash) AS people FROM downloads").first();
      const lib = await db.prepare("SELECT COUNT(*) AS n FROM lib_fonts WHERE status = 'public'").first();
      return json({ ok: true, days: days.results || [], total: tot, library: lib });
    }
    if (what === "fonts") {
      const { results } = await db.prepare(
        `SELECT id, created_at, nickname, title, note, size, parent_id, status, country, substr(sha256, 1, 12) AS v,
                substr(ip_hash, 1, 6) AS who
           FROM lib_fonts ORDER BY id DESC LIMIT 500`).all();
      return json({ ok: true, items: results || [] });
    }
    if (what === "comments") {
      const { results } = await db.prepare(
        `SELECT c.id, c.font_id, c.created_at, c.nickname, c.message, c.kind, c.letters, c.status, c.fixed_by,
                f.title AS font_title
           FROM lib_comments c LEFT JOIN lib_fonts f ON f.id = c.font_id ORDER BY c.id DESC LIMIT 500`).all();
      return json({ ok: true, items: results || [] });
    }
    if (what === "feedback") {
      const { results } = await db.prepare(
        "SELECT id, created_at, kind, message, font, nickname, status, reply FROM feedback ORDER BY id DESC LIMIT 500").all();
      return json({ ok: true, items: results || [] });
    }
    return json({ ok: false, error: "not_found" }, 404);
  }
  if (request.method === "POST" && what === "replace") {
    // {id, font: base64 WOFF} — swap a library font's file (e.g. a repaired copy)
    let b; try { b = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400); }
    const id = parseInt(b.id, 10);
    let buf;
    try { const bin = atob(String(b.font || "")); buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); }
    catch { return json({ ok: false, error: "bad_request" }, 400); }
    const tag = buf.length > 4 ? String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) : "";
    if (!id || (tag !== "wOFF" && tag !== "wOF2") || buf.length > 1900000) return json({ ok: false, error: "type" }, 415);
    const dg = await crypto.subtle.digest("SHA-256", buf);
    const sha = [...new Uint8Array(dg)].map((x) => x.toString(16).padStart(2, "0")).join("");
    let changes = null;
    if (b.edited) {
      const row = await db.prepare("SELECT changes FROM lib_fonts WHERE id = ?").bind(id).first();
      try { const c = JSON.parse((row && row.changes) || "{}"); c.edited = String(b.edited).slice(0, 80); changes = JSON.stringify(c); } catch (e) {}
    }
    await db.prepare("UPDATE lib_fonts SET data = ?, size = ?, sha256 = ?, changes = COALESCE(?, changes), updated_at = datetime('now') WHERE id = ?")
      .bind(buf.buffer, buf.length, sha, changes, id).run();
    return json({ ok: true, size: buf.length });
  }
  if (request.method === "POST" && what === "action") {
    let b; try { b = await request.json(); } catch { return json({ ok: false, error: "bad_request" }, 400); }
    const table = TABLES[b.kind]; const id = parseInt(b.id, 10);
    if (!table || !id) return json({ ok: false, error: "bad_request" }, 400);
    if (b.action === "hide" || b.action === "show") {
      await db.prepare(`UPDATE ${table} SET status = ? WHERE id = ?`).bind(b.action === "hide" ? "hidden" : "public", id).run();
    } else if (b.action === "delete") {
      if (b.kind === "font") {
        await db.prepare("DELETE FROM lib_comments WHERE font_id = ?").bind(id).run();
        await db.prepare("UPDATE lib_fonts SET parent_id = NULL WHERE parent_id = ?").bind(id).run();
      }
      await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
    } else if (b.action === "reply" && b.kind === "feedback") {
      await db.prepare("UPDATE feedback SET reply = ? WHERE id = ?").bind(String(b.text || "").slice(0, 1000) || null, id).run();
    } else return json({ ok: false, error: "bad_request" }, 400);
    return json({ ok: true });
  }
  return json({ ok: false, error: "not_found" }, 404);
}
