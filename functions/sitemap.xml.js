// GET /sitemap.xml — the public pages plus one URL per font in the library
export async function onRequestGet({ env }) {
  const base = "https://ou-font.pages.dev";
  const urls = [["/", "weekly", "1.0"], ["/belen/", "weekly", "0.9"], ["/fontsan/", "daily", "0.8"], ["/sanal/", "weekly", "0.4"]]
    .map(([u, f, p]) => `<url><loc>${base}${u}</loc><changefreq>${f}</changefreq><priority>${p}</priority></url>`);
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, COALESCE(updated_at, created_at) AS t FROM lib_fonts WHERE status = 'public' AND parent_id IS NULL ORDER BY id DESC LIMIT 1000"
    ).all();
    for (const r of results || []) {
      urls.push(`<url><loc>${base}/fontsan/f/${r.id}</loc><lastmod>${String(r.t).slice(0, 10)}</lastmod><priority>0.6</priority></url>`);
    }
  } catch (e) {}
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
