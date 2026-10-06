import { createServer } from "node:http";

/**
 * A small stand-in for Supabase Storage's HTTP API (just what app/lib/storage.js uses): bucket
 * get/create, object upload and remove, and public reads/HEAD. Lets the whole suite exercise the
 * real "pictures live in Storage" path without a Supabase project.
 */
export function startFakeStorage(port) {
  const objects = new Map(); // "bucket/path" -> { body: Buffer, contentType }
  const buckets = new Set();

  async function readBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  // Raw body, or a multipart/form-data upload (what storage-js sends for Blob bodies).
  function unwrapUpload(body, contentType) {
    const match = /multipart\/form-data;\s*boundary=(.+)$/i.exec(contentType || "");
    if (!match) return { body, contentType: contentType || "application/octet-stream" };
    const boundary = Buffer.from(`--${match[1]}`);
    const start = body.indexOf(boundary);
    const headerEnd = body.indexOf("\r\n\r\n", start);
    const end = body.indexOf(boundary, headerEnd);
    const head = body.subarray(start, headerEnd).toString();
    const type = /content-type:\s*([^\r\n]+)/i.exec(head)?.[1] || "application/octet-stream";
    return { body: body.subarray(headerEnd + 4, end - 2), contentType: type };
  }

  const json = (res, status, payload) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = decodeURIComponent(url.pathname);

    const publicMatch = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(path);
    if (publicMatch && (req.method === "GET" || req.method === "HEAD")) {
      const object = objects.get(`${publicMatch[1]}/${publicMatch[2]}`);
      if (!object) return json(res, 404, { error: "not_found" });
      res.writeHead(200, { "Content-Type": object.contentType, "Content-Length": String(object.body.length) });
      return res.end(req.method === "HEAD" ? undefined : object.body);
    }

    const bucketMatch = /^\/storage\/v1\/bucket\/([^/]+)$/.exec(path);
    if (bucketMatch && req.method === "GET") {
      return buckets.has(bucketMatch[1]) ? json(res, 200, { id: bucketMatch[1], name: bucketMatch[1], public: true }) : json(res, 404, { error: "Bucket not found" });
    }
    if (path === "/storage/v1/bucket" && req.method === "POST") {
      const { name } = JSON.parse((await readBody(req)).toString() || "{}");
      buckets.add(name);
      return json(res, 200, { name });
    }

    const objectMatch = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(path);
    if (objectMatch && (req.method === "POST" || req.method === "PUT")) {
      const key = `${objectMatch[1]}/${objectMatch[2]}`;
      if (objects.has(key) && req.headers["x-upsert"] !== "true") return json(res, 400, { error: "Duplicate" });
      objects.set(key, unwrapUpload(await readBody(req), req.headers["content-type"]));
      return json(res, 200, { Key: key });
    }

    const removeMatch = /^\/storage\/v1\/object\/([^/]+)$/.exec(path);
    if (removeMatch && req.method === "DELETE") {
      const { prefixes = [] } = JSON.parse((await readBody(req)).toString() || "{}");
      for (const prefix of prefixes) objects.delete(`${removeMatch[1]}/${prefix}`);
      return json(res, 200, []);
    }

    json(res, 404, { error: `unhandled ${req.method} ${path}` });
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve({
      url: `http://localhost:${port}`,
      count: () => objects.size,
      keys: () => [...objects.keys()],
      close: () => new Promise((done) => server.close(done))
    }));
  });
}
