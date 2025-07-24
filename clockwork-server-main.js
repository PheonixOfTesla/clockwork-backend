const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const winston = require('winston');
require('dotenv').config();

// Lazy load database connections
let dbConnected = false;
let redisConnected = false;

// Import routes
const authRoutes = require('./clockwork-auth-routes');
// Add other routes as needed

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });
  next();
});

// Lazy database connection middleware
const ensureDbConnection = async (req, res, next) => {
  if (!dbConnected && process.env.DATABASE_URL) {
    try {
      const { connectDB } = require('./clockwork-database-config');
      await connectDB();
      dbConnected = true;
      logger.info('Database connected');
    } catch (error) {
      logger.error('Database connection failed:', error);
      // Continue anyway for endpoints that don't need DB
    }
  }
  next();
};

// Apply lazy connection middleware
app.use(ensureDbConnection);

// Health check endpoint (no DB required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    dbConnected,
    redisConnected
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Clockwork API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      users: '/api/users',
      workouts: '/api/workouts'
    }
  });
});

// API Routes (only add if the route file exists)
try {
  app.use('/api/auth', authRoutes);
} catch (e) {
  logger.warn('Auth routes not loaded:', e.message);
}

// Add other routes with try-catch blocks
const routeModules = [
  { path: '/api/users', module: './routes/users' },
  { path: '/api/measurements', module: './routes/measurements' },
  { path: '/api/workouts', module: './routes/workouts' },
  { path: '/api/nutrition', module: './routes/nutrition' },
  { path: '/api/goals', module: './routes/goals' },
  { path: '/api/billing', module: './routes/billing' },
  { path: '/api/chat', module: './routes/chat' },
  { path: '/api/reports', module: './routes/reports' }
];

routeModules.forEach(({ path, module }) => {
  try {
    const route = require(module);
    app.use(path, route);
  } catch (e) {
    logger.warn(`Route ${module} not loaded:`, e.message);
    // Create a placeholder route
    app.use(path, (req, res) => {
      res.status(503).json({ 
        error: 'Service temporarily unavailable',
        message: `${path} module is being configured`
      });
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.url}`,
    availableEndpoints: {
      health: '/health',
      api: '/api/*'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Export for Vercel

// Start the server if not in Vercel environment
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;