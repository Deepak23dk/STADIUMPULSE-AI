require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { rateLimit } = require('express-rate-limit');
const { getStadiumState } = require('./stadiumState');
const { handleUserQuery } = require('./orchestrator');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all requests
app.use(cors());

// Parse incoming JSON requests
app.use(express.json());

// Input Sanitization Middleware
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body.query === 'string') {
    let sanitized = req.body.query
      .trim()
      .slice(0, 500) // limit size to prevent abuse
      .replace(/[<>]/g, ""); // strip simple HTML brackets
    req.body.query = sanitized;
  }
  next();
}

// Rate Limiter for Chat Endpoint (20 requests per minute)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: {
    error: "Too many chat queries. Please wait a minute before trying again."
  },
  standardHeaders: true,
  legacyHeaders: false
});

// API Routes
app.get('/api/stadium-state', (req, res) => {
  try {
    const state = getStadiumState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve stadium state" });
  }
});

app.post('/api/chat', chatLimiter, sanitizeInput, async (req, res) => {
  const { query, language, isOps } = req.body;

  if (!query || query.trim() === "") {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const result = await handleUserQuery(query, language || 'en', !!isOps);
    res.json(result);
  } catch (err) {
    console.error("Error in /api/chat:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve frontend build static files in production
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Catch-all route to serve React's index.html in production
app.get('*', (req, res, next) => {
  // If request is for an API route that wasn't matched, return 404
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: "API route not found" });
  }
  
  // Otherwise serve React app
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      // In development or if frontend isn't built yet, respond with a helpful note
      res.status(200).send("StadiumPulse AI API is running. Build the frontend to see the UI here!");
    }
  });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`StadiumPulse AI backend running on port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Gemini API: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Missing (Falling back to local rules)'}`);
  console.log(`==================================================`);
});
