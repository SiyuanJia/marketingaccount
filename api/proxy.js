// Vercel Serverless Function for CORS Proxy
// Handles DashScope ASR API requests with CORS support

export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-DashScope-Async'
    );
    res.setHeader('Access-Control-Max-Age', '600');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    // Health check
    if (req.url === '/api/proxy' && req.method === 'GET') {
      return res.status(200).json({ status: 'ok', message: 'CORS proxy is running' });
    }

    // Parse target URL from query param
    const { url: target } = req.query;
    if (!target) {
      return res.status(400).json({ 
        error: 'Missing target URL', 
        message: 'Please provide "url" query parameter' 
      });
    }

    // Validate target URL
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Invalid target URL', 
        message: 'The provided URL is not valid' 
      });
    }

    // Security: Only allow specific domains
    const allowedDomains = [
      'dashscope.aliyuncs.com',
      'api.302.ai',
      'open.feishu.cn'
    ];
    
    if (!allowedDomains.includes(targetUrl.hostname)) {
      return res.status(403).json({ 
        error: 'Domain not allowed', 
        message: `Only ${allowedDomains.join(', ')} are allowed` 
      });
    }

    // Prepare headers for upstream request
    const headers = {};
    if (req.headers['authorization']) {
      headers['authorization'] = req.headers['authorization'];
    }
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'];
    }
    if (req.headers['x-dashscope-async']) {
      headers['x-dashscope-async'] = req.headers['x-dashscope-async'];
    }

    // Forward request to target
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    // Get response data
    const data = await response.text();
    
    // Set response headers (excluding problematic ones)
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      const blockedHeaders = [
        'access-control-allow-origin',
        'access-control-allow-headers', 
        'access-control-allow-methods',
        'content-encoding',
        'content-length',
        'transfer-encoding',
        'connection'
      ];
      
      if (!blockedHeaders.includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });

    // Return response
    res.status(response.status);
    
    // Try to parse as JSON, fallback to text
    try {
      const jsonData = JSON.parse(data);
      return res.json(jsonData);
    } catch {
      return res.send(data);
    }

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(502).json({ 
      error: 'Proxy error', 
      message: error.message 
    });
  }
}
