// GET /api/lib/:id/font — the font file of a public library entry
export async function onRequestGet({ params, env }) {
  const id = parseInt(params.id, 10);
  const row = id && await env.DB.prepare("SELECT title, data FROM lib_fonts WHERE id = ? AND status = 'public'").bind(id).first();
  if (!row || !row.data) return new Response("not found", { status: 404 });
  const bytes = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : new Uint8Array(row.data);
  const isW2 = bytes[3] === 0x32;
  const name = (row.title || "font").replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "-") || "font";
  return new Response(bytes, {
    headers: {
      "content-type": isW2 ? "font/woff2" : "font/woff",
      "content-disposition": `inline; filename="${name}-MN.${isW2 ? "woff2" : "woff"}"`,
      "cache-control": "public, max-age=86400",
    },
  });
}
