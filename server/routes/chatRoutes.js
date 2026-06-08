const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  proxyChat,
  proxyReindex,
  proxyChatHistory,
} = require('../controllers/chatController');

/**
 * Chat Routes — Proxy to FastAPI RAG Service
 * POST /api/chat              - Send chat message (SSE streamed response)
 * POST /api/chat/reindex      - Rebuild vector store for user
 * GET  /api/chat/history/:sessionId - Get chat history for a session
 */

router.post('/', auth, proxyChat);
router.post('/reindex', auth, proxyReindex);
router.get('/history/:sessionId', auth, proxyChatHistory);

module.exports = router;
