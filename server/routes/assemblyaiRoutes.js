const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getStreamingToken } = require('../controllers/assemblyaiController');

/**
 * AssemblyAI Routes
 * GET /api/assemblyai/token - Generate a temporary streaming token
 */

router.get('/token', auth, getStreamingToken);

module.exports = router;
