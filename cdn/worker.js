// moon-cdn — serves R2 media objects by path, with Range support for seeking.
function parseRange(h) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(h || "");
  if (!m) return null;
  const s = m[1], e = m[2];
  if (s === "" && e === "") return null;
  if (s === "") return { suffix: parseInt(e, 10) };        // bytes=-N
  if (e === "") return { offset: parseInt(s, 10) };         // bytes=N-
  return { offset: parseInt(s, 10), length: parseInt(e, 10) - parseInt(s, 10) + 1 };
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const key = decodeURIComponent(url.pathname.slice(1));
      if (!key) return new Response("Forbidden", { status: 403 });

      const range = parseRange(request.headers.get("range"));
      const object = range ? await env.MEDIA.get(key, { range }) : await env.MEDIA.get(key);
      if (!object) return new Response("Not Found", { status: 404 });

      const total = object.size;
      const headers = new Headers();
      headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Accept-Ranges", "bytes");
      if (object.httpEtag) headers.set("ETag", object.httpEtag);

      if (range) {
        let start, end;
        if ("length" in range) { start = range.offset; end = range.offset + range.length - 1; }
        else if ("offset" in range) { start = range.offset; end = total - 1; }
        else { start = Math.max(0, total - range.suffix); end = total - 1; }
        headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
        headers.set("Content-Length", String(end - start + 1));
        return new Response(object.body, { status: 206, headers });
      }
      headers.set("Content-Length", String(total));
      return new Response(object.body, { headers });
    } catch (e) {
      return new Response("ERR: " + (e?.message || e), { status: 500 });
    }
  },
};
