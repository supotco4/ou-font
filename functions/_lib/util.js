export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function ipHash(request) {
  const ip = request.headers.get("cf-connecting-ip") || "";
  if (!ip) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "|ou-font"));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// the site owner: the request carries a key whose hash is in admin_keys
export async function isAdmin(request, env) {
  const key = request.headers.get("x-admin-key") || "";
  if (key.length < 16) return false;
  const row = await env.DB.prepare("SELECT 1 AS ok FROM admin_keys WHERE hash = ?").bind(await sha256Hex(key)).first();
  return !!row;
}

// a font's uploader: the key handed back when the font was saved
export async function ownsFont(request, env, id) {
  const key = request.headers.get("x-owner-key") || "";
  if (key.length < 16) return false;
  const row = await env.DB.prepare("SELECT owner_hash FROM lib_fonts WHERE id = ?").bind(id).first();
  return !!(row && row.owner_hash && row.owner_hash === (await sha256Hex(key)));
}
