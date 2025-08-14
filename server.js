const express = require('express');
const cors = require('cors');
const path = require('path');

// Import configuration and logging
const config = require('./src/config/env');
const logger = require('./src/config/logger');
const { initializeDatabase } = require('./src/config/database');

// Import middleware
const { securityHeaders, rateLimiter, validateURL, validateText, createUserRateLimit } = require('./src/middleware/security');
const { authenticateUser, optionalAuth, checkSupabaseConnection } = require('./src/middleware/auth');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// Import controllers
const newsController = require('./src/controllers/newsController');
const translationController = require('./src/controllers/translationController');
const statusController = require('./src/controllers/statusController');
const userController = require('./src/controllers/userController');

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

// Root endpoint - serve index.html with Supabase configuration injected (must come before static middleware)
app.get('/', (req, res) => {
    const fs = require('fs');
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Inject Supabase configuration into the page
    const configScript = `
        <script>
            window.SUPABASE_URL = '${config.SUPABASE_URL || ''}';
            window.SUPABASE_ANON_KEY = '${config.SUPABASE_ANON_KEY || ''}';
        </script>
    `;
    
    // Insert config script at the beginning of head tag (after opening)
    html = html.replace('<head>', `<head>${configScript}`);
    
    res.send(html);
});

// Serve static files (after root endpoint to prevent index.html conflict)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (no rate limiting)
app.get('/health', statusController.getHealth);

// API Routes - All require authentication
// Create user-specific rate limiter
const userRateLimit = createUserRateLimit(50, 15); // 50 requests per 15 minutes per user

// User management endpoints
app.get('/api/user/profile', authenticateUser, userController.getProfile);
app.put('/api/user/profile', authenticateUser, userRateLimit, userController.updateProfile);
app.get('/api/user/dashboard', authenticateUser, userController.getDashboard);
app.delete('/api/user/account', authenticateUser, userController.deleteAccount);

// User feeds management
app.get('/api/user/feeds', authenticateUser, userController.getFeeds);
app.post('/api/user/feeds', authenticateUser, userRateLimit, validateURL, userController.addFeed);
app.delete('/api/user/feeds/:feedId', authenticateUser, userController.removeFeed);

// User reading history
app.get('/api/user/history', authenticateUser, userController.getReadingHistory);
app.post('/api/user/history/read', authenticateUser, userRateLimit, userController.markAsRead);
app.get('/api/user/summaries', authenticateUser, userController.getSummaries);

// News endpoints (user-specific)
app.get('/api/news', authenticateUser, userRateLimit, newsController.getNews);
app.post('/api/news/process', authenticateUser, userRateLimit, newsController.processNews);

// Translation endpoints (user-specific)
app.post('/api/translate', authenticateUser, userRateLimit, validateText, translationController.translateText);
app.get('/api/translate/usage', authenticateUser, translationController.getUsage);
app.get('/api/translate/languages', authenticateUser, translationController.getLanguages);

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
const server = app.listen(config.PORT, async () => {
    logger.info('News Summarizer server started', {
        port: config.PORT,
        environment: config.NODE_ENV,
        url: `http://localhost:${config.PORT}`
    });
    
    // Log API services status
    const services = {
        deepl: config.DEEPL_API_KEY && config.DEEPL_API_KEY !== 'your_deepl_key_here',
        openai: config.OPENAI_API_KEY && config.OPENAI_API_KEY !== 'your_openai_key_here',
        supabase: config.SUPABASE_URL && config.SUPABASE_ANON_KEY
    };
    
    logger.info('API Services Status', {
        deepl: services.deepl ? 'configured' : 'not configured',
        openai: services.openai ? 'configured' : 'not configured',
        supabase: services.supabase ? 'configured' : 'not configured'
    });
    
    // Check Supabase connection and initialize database
    try {
        const connected = await checkSupabaseConnection();
        logger.info('Supabase connection status', { connected });
        
        if (connected && services.supabase) {
            // Initialize database tables automatically
            logger.info('Starting automatic database initialization...');
            const dbInitialized = await initializeDatabase();
            
            if (dbInitialized) {
                logger.info('Database initialization completed successfully');
            } else {
                logger.warn('Database initialization completed with warnings - check logs for details');
            }
        } else {
            logger.warn('Skipping database initialization - Supabase not properly configured or connected');
        }
    } catch (error) {
        logger.error('Startup database initialization failed', { error: error.message });
    }
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