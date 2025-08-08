const logger = require('../config/logger');
const config = require('../config/env');

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    
    // Don't expose error details in production
    const isDevelopment = config.NODE_ENV === 'development';
    
    let statusCode = 500;
    let message = 'Wystąpił błąd serwera';
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Nieprawidłowe dane wejściowe';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Brak autoryzacji';
    } else if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        message = 'Plik jest zbyt duży';
    }
    
    res.status(statusCode).json({
        error: message,
        ...(isDevelopment && { 
            details: err.message,
            stack: err.stack 
        })
    });
};

// 404 handler
const notFoundHandler = (req, res) => {
    logger.warn('404 Not Found', {
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    
    res.status(404).json({
        error: 'Zasób nie został znaleziony'
    });
};

// Async error wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler
};