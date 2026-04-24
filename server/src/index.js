const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');
const authMiddleware = require('./middleware/auth');
const { router: authRouter } = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Auth routes (no auth needed)
app.use('/api/auth', authRouter);

// All other API routes require auth
app.use('/api/applications', authMiddleware, require('./routes/applications'));
app.use('/api/timeline', authMiddleware, require('./routes/timeline'));
app.use('/api/todos', authMiddleware, require('./routes/todos'));
app.use('/api/analytics', authMiddleware, require('./routes/analytics'));
app.use('/api/ocr', authMiddleware, require('./routes/ocr'));
app.use('/api/parse-url', authMiddleware, require('./routes/parseUrl'));
app.use('/api/import', authMiddleware, require('./routes/import'));
app.use('/api/calendar', authMiddleware, require('./routes/calendar'));
app.use('/api/ratings', authMiddleware, require('./routes/ratings'));
app.use('/api/report', authMiddleware, require('./routes/report'));
app.use('/api/share', require('./routes/share')); // share has its own auth for public links

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve static files
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get(/^\/(?!api)/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
