const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Database connection
const connectDB = require('./config/db');

// Route imports
const authRoutes = require('./routes/authRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const reportRoutes = require('./routes/reportRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Middleware imports
const errorHandler = require('./middleware/errorHandler');

/**
 * AI Interviewer - Express Server Entry Point
 * Sets up middleware, routes, error handling, and starts listening.
 */

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// ------- Middleware Configuration -------

// Enable CORS for the client application
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Parse JSON request bodies (limit 50MB for large payloads)
app.use(express.json({ limit: '50mb' }));

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files as static assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ------- API Routes -------

app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// ------- Error Handling -------

// Global error handler (must be after all routes)
app.use(errorHandler);

// ------- Start Server -------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});
