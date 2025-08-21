// dev-proxy.js
// 本地开发环境的CORS代理服务器
// 使用方法: node dev-proxy.js

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
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ 
        status: 'ok', 
        message: 'Development CORS proxy is running',
        timestamp: new Date().toISOString()
      }));
    }

    // Parse target URL from query param: ?url=<encoded>
    const full = new URL(req.url, `http://localhost:${PORT}`);
    const target = full.searchParams.get('url');
    if (!target) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        error: 'Missing target URL',
        message: 'Please provide "url" query parameter'
      }));
    }

    // Validate target URL
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (error) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        error: 'Invalid target URL',
        message: 'The provided URL is not valid'
      }));
    }

    // Security: Only allow specific domains
    const allowedDomains = [
      'dashscope.aliyuncs.com',
      'api.302.ai',
      'open.feishu.cn'
    ];
    
    if (!allowedDomains.includes(targetUrl.hostname)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({
        error: 'Domain not allowed',
        message: `Only ${allowedDomains.join(', ')} are allowed`
      }));
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

    console.log(`🔄 代理请求: ${req.method} ${target}`);
    console.log(`📡 来源: ${req.headers['origin'] || 'unknown'}`);

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
    console.log(`✅ 代理响应: ${upstream.status} (${buf.length} bytes)`);
    
    // Do not set Content-Length; let Node chunk it to avoid mismatch with stripped headers
    res.end(buf);
  } catch (err) {
    console.error('❌ 代理错误:', err.message);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ 
      error: 'proxy_error', 
      message: err.message,
      timestamp: new Date().toISOString()
    }));
  }
});

server.listen(PORT, () => {
  console.log('🚀 本地开发代理服务器启动成功！');
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🌐 代理地址: http://localhost:${PORT}`);
  console.log(`🔍 健康检查: http://localhost:${PORT}/healthz`);
  console.log('');
  console.log('💡 使用说明:');
  console.log('  - 保持此终端窗口打开');
  console.log('  - 在浏览器中打开 http://localhost:8000');
  console.log('  - 配置API Key后即可使用语音识别功能');
  console.log('');
  console.log('⏹️  停止服务器: Ctrl+C');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭代理服务器...');
  server.close(() => {
    console.log('✅ 代理服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 收到终止信号，正在关闭代理服务器...');
  server.close(() => {
    console.log('✅ 代理服务器已关闭');
    process.exit(0);
  });
});
