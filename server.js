const express = require('express');
const cors = require('cors');
const path = require('path');

// Import configuration and logging
const config = require('./src/config/env');
const logger = require('./src/config/logger');

// Import middleware
const { securityHeaders, rateLimiter, validateURL, validateText } = require('./src/middleware/security');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// Import controllers
const newsController = require('./src/controllers/newsController');
const translationController = require('./src/controllers/translationController');
const statusController = require('./src/controllers/statusController');

const app = express();

// Security middleware
app.use(securityHeaders);

// CORS configuration
app.use(cors({
    origin: config.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting on API routes
app.use('/api', rateLimiter);

// Request logging middleware
app.use((req, res, next) => {
    logger.info('Request received', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Root endpoint - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint (no rate limiting)
app.get('/health', statusController.getHealth);

// API Routes
// News endpoints
app.get('/api/news', newsController.getNews);
app.post('/api/news', validateURL, newsController.processNews);

// Translation endpoints
app.post('/api/translate', validateText, translationController.translateText);
app.get('/api/translate/usage', translationController.getUsage);

// Status endpoints
app.get('/api/status', statusController.getStatus);
app.get('/api/metrics', statusController.getMetrics); // Development only

// 404 handler for unknown routes
app.use('*', notFoundHandler);

// Global error handling middleware
app.use(errorHandler);

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    
    server.close(() => {
        logger.info('Process terminated gracefully');
        process.exit(0);
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

// Start server
const server = app.listen(config.PORT, () => {
    logger.info('News Summarizer server started', {
        port: config.PORT,
        environment: config.NODE_ENV,
        url: `http://localhost:${config.PORT}`
    });
    
    // Log API services status
    const services = {
        deepl: config.DEEPL_API_KEY && config.DEEPL_API_KEY !== 'your_deepl_key_here',
        openai: config.OPENAI_API_KEY && config.OPENAI_API_KEY !== 'your_openai_key_here'
    };
    
    logger.info('API Services Status', {
        deepl: services.deepl ? 'configured' : 'not configured',
        openai: services.openai ? 'configured' : 'not configured'
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    process.exit(1);
});

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;