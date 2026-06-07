require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { errorHandler, notFound } = require('./middleware/errorHandler');
const db = require('./db/connection');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: false, // we serve the SPA
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN || true),
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limit
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } }
});
app.use('/api', limiter);

// Health (unauth) — mounted before any auth middleware
app.get('/api/health', (req, res) => {
  try {
    const row = db.prepare('SELECT COUNT(*) AS c FROM users').get();
    res.json({ success: true, data: { status: 'ok', users: row.c, timestamp: new Date().toISOString() } });
  } catch (e) {
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: e.message } });
  }
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/academics'));
app.use('/api', require('./routes/attendanceGrades'));
app.use('/api', require('./routes/fees'));
app.use('/api', require('./routes/library'));
app.use('/api', require('./routes/hostel'));
app.use('/api', require('./routes/notices'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api', require('./routes/users'));

// Serve frontend
const frontendDir = path.resolve(__dirname, '../../frontend');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

app.use('/api/*', notFound);
app.use(errorHandler);

const PORT = parseInt(process.env.PORT) || 4000;
const startServer = () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║           COLLEGE ERP SYSTEM - SERVER UP             ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Port:   ${String(PORT).padEnd(44)} ║`);
    console.log(`║  Env:    ${(process.env.NODE_ENV || 'development').padEnd(44)} ║`);
    console.log(`║  URL:    http://localhost:${PORT}`.padEnd(57) + '║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log('');
  });
};

if (require.main === module) {
  startServer();
}

module.exports = app;
