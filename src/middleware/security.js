const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const config = require('../config/env');
const logger = require('../config/logger');

// Security headers
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'"]
        }
    }
});

// Rate limiting middleware
const rateLimiter = rateLimit({
    windowMs: config.RATE_LIMIT.windowMs,
    max: config.RATE_LIMIT.max,
    message: {
        error: 'Przekroczono limit requestów. Spróbuj ponownie za chwilę.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Rate limit exceeded', { 
            ip: req.ip, 
            userAgent: req.get('User-Agent') 
        });
        res.status(429).json({
            error: 'Przekroczono limit requestów. Spróbuj ponownie za chwilę.'
        });
    }
});

// URL validation middleware
const validateURL = (req, res, next) => {
    const { rssUrl } = req.body;
    
    if (!rssUrl) {
        return res.status(400).json({ error: 'RSS URL jest wymagany' });
    }
    
    // Basic URL validation
    if (!validator.isURL(rssUrl, { 
        protocols: ['http', 'https'],
        require_protocol: true 
    })) {
        logger.warn('Invalid URL provided', { url: rssUrl, ip: req.ip });
        return res.status(400).json({ error: 'Nieprawidłowy format URL' });
    }
    
    // Domain whitelist check
    const url = new URL(rssUrl);
    const isAllowedDomain = config.ALLOWED_DOMAINS.some(domain => 
        url.hostname === domain || url.hostname.endsWith('.' + domain)
    );
    
    if (!isAllowedDomain) {
        logger.warn('Unauthorized domain access attempt', { 
            domain: url.hostname, 
            ip: req.ip 
        });
        return res.status(403).json({ 
            error: 'Domena nie jest dozwolona',
            allowedDomains: config.ALLOWED_DOMAINS
        });
    }
    
    next();
};

// Text validation middleware
const validateText = (req, res, next) => {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Tekst jest wymagany' });
    }
    
    if (text.trim().length === 0) {
        return res.status(400).json({ error: 'Tekst nie może być pusty' });
    }
    
    if (text.length > config.MAX_TEXT_LENGTH) {
        return res.status(400).json({ 
            error: `Tekst nie może być dłuższy niż ${config.MAX_TEXT_LENGTH} znaków` 
        });
    }
    
    // Sanitize text
    req.body.text = validator.escape(text);
    next();
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = validator.escape(req.body[key]);
            }
        }
    }
    next();
};

module.exports = {
    securityHeaders,
    rateLimiter,
    validateURL,
    validateText,
    sanitizeInput
};