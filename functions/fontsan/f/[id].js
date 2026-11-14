// GET /fontsan/f/:id — the library page with this font's own title and
// share preview in the HTML (for search engines and link previews); the
// page script opens the font from the path.
const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function onRequestGet({ request, env, params }) {
  const id = parseInt(params.id, 10);
  const page = await env.ASSETS.fetch(new URL("/fontsan/", request.url));
  if (!id) return page;
  let row = null;
  try {
    row = await env.DB.prepare(
      "SELECT id, title, nickname, note, changes, parent_id FROM lib_fonts WHERE id = ? AND status = 'public'"
    ).bind(id).first();
  } catch (e) {}
  if (!row) return page;
  let ch = {};
  try { ch = JSON.parse(row.changes || "{}"); } catch (e) {}
  const title = `${row.title || "Фонт"} — монгол үсэгтэй фонт татах | Өү`;
  const what = ch.mode === "all" ? "бүх кирилл үсэг" : "Ө, Ү үсэг";
  const desc = `${row.title || "Фонт"}: ${what} нэмсэн хувилбар. Оруулсан: ${row.nickname || "Нэргүй"}.${row.note ? " " + row.note : ""} Үнэгүй татаж, сэтгэгдэл үлдээгээрэй.`.slice(0, 300);
  const url = `https://ou-font.pages.dev/fontsan/f/${row.id}`;
  let html = await page.text();
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`);
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}
