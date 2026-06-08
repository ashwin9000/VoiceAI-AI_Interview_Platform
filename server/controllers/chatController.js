const http = require('http');
const https = require('https');

/**
 * Chat Controller.
 * Proxies chat requests to the FastAPI RAG service,
 * forwarding the JWT token and piping SSE streams back to the client.
 */

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || 'http://localhost:8000';

/**
 * Make a proxied request to the RAG service.
 * @param {string} path - The path on the RAG service (e.g. '/chat')
 * @param {object} options - { method, body, headers }
 * @returns {Promise<http.IncomingMessage>} The raw response stream
 */
const proxyRequest = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, RAG_SERVICE_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const proxyReq = lib.request(reqOptions, (proxyRes) => {
      resolve(proxyRes);
    });

    proxyReq.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      proxyReq.write(
        typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)
      );
    }

    proxyReq.end();
  });
};

/**
 * @desc    Proxy chat message to FastAPI RAG service (SSE stream)
 * @route   POST /api/chat
 * @access  Private
 */
const proxyChat = async (req, res, next) => {
  try {
    const { message, session_id } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a message.',
      });
    }

    // Set SSE headers immediately
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    });

    // Forward request to FastAPI with the user's JWT
    const proxyRes = await proxyRequest('/chat', {
      method: 'POST',
      body: { message, session_id: session_id || undefined },
      headers: {
        Authorization: req.headers.authorization,
      },
    });

    // Pipe the SSE stream directly to the client
    proxyRes.on('data', (chunk) => {
      res.write(chunk);
    });

    proxyRes.on('end', () => {
      res.end();
    });

    proxyRes.on('error', (err) => {
      console.error('❌ RAG service stream error:', err.message);
      // Send error event before closing
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream error from RAG service' })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      proxyRes.destroy();
    });
  } catch (error) {
    // If headers haven't been sent yet, respond with JSON error
    if (!res.headersSent) {
      return res.status(502).json({
        success: false,
        error: 'RAG service is unavailable. Please ensure the service is running.',
      });
    }
    // Otherwise send SSE error and close
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Connection to RAG service failed' })}\n\n`);
    res.end();
  }
};

/**
 * @desc    Proxy reindex request to FastAPI RAG service
 * @route   POST /api/chat/reindex
 * @access  Private
 */
const proxyReindex = async (req, res, next) => {
  try {
    const proxyRes = await proxyRequest('/chat/reindex', {
      method: 'POST',
      headers: {
        Authorization: req.headers.authorization,
      },
    });

    let body = '';
    proxyRes.on('data', (chunk) => { body += chunk; });
    proxyRes.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.status(proxyRes.statusCode).json(data);
      } catch {
        res.status(502).json({
          success: false,
          error: 'Invalid response from RAG service.',
        });
      }
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: 'RAG service is unavailable. Please ensure the service is running.',
    });
  }
};

/**
 * @desc    Proxy chat history request to FastAPI RAG service
 * @route   GET /api/chat/history/:sessionId
 * @access  Private
 */
const proxyChatHistory = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const proxyRes = await proxyRequest(`/chat/history/${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: req.headers.authorization,
      },
    });

    let body = '';
    proxyRes.on('data', (chunk) => { body += chunk; });
    proxyRes.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.status(proxyRes.statusCode).json(data);
      } catch {
        res.status(502).json({
          success: false,
          error: 'Invalid response from RAG service.',
        });
      }
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: 'RAG service is unavailable. Please ensure the service is running.',
    });
  }
};

module.exports = { proxyChat, proxyReindex, proxyChatHistory };
