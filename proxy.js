// proxy.js
// Minimal CORS proxy for DashScope ASR
// Requires: Node 18+ (uses global fetch)

const http = require('http');
const { URL } = require('url');

const PORT = process.env.PORT || 3001;

function setCors(res, req) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-DashScope-Async'
  );
  res.setHeader('Access-Control-Max-Age', '600');
}

const server = http.createServer(async (req, res) => {
  try {
    // CORS preflight
    setCors(res, req);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    // Health check
    if (req.url.startsWith('/healthz')) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.end('ok');
    }

    // Parse target URL from query param: ?url=<encoded>
    const full = new URL(req.url, `http://localhost:${PORT}`);
    const target = full.searchParams.get('url');
    if (!target) {
      res.statusCode = 400;
      return res.end('Missing "url" query parameter');
    }

    // Read incoming body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    // Forward headers (whitelist)
    const headers = {};
    if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    if (req.headers['x-dashscope-async']) headers['x-dashscope-async'] = req.headers['x-dashscope-async'];

    // Forward request
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
    });

    // Relay status and headers
    res.statusCode = upstream.status;
    upstream.headers.forEach((v, k) => {
      const lower = k.toLowerCase();
      // Strip headers that can cause decoding issues when Node has already decompressed the body
      const blocked = [
        'access-control-allow-origin',
        'access-control-allow-headers',
        'access-control-allow-methods',
        'content-encoding',
        'content-length',
        'transfer-encoding',
        'connection'
      ];
      if (!blocked.includes(lower)) {
        res.setHeader(k, v);
      }
    });

    const buf = Buffer.from(await upstream.arrayBuffer());
    // Do not set Content-Length; let Node chunk it to avoid mismatch with stripped headers
    res.end(buf);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'proxy_error', message: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`CORS proxy listening on http://localhost:${PORT}`);
  console.log('Health check: http://localhost:3001/healthz');
});

