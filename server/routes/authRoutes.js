const express = require('express');
const router = express.Router();
const { signup, login, getMe } = require('../controllers/authController');
const auth = require('../middleware/auth');

/**
 * Auth Routes
 * POST /api/auth/signup  - Register a new user
 * POST /api/auth/login   - Login an existing user
 * GET  /api/auth/me      - Get current user profile (protected)
 */

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', auth, getMe);

module.exports = router;
