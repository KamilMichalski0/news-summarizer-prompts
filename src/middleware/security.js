const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const config = require('../config/env');
const logger = require('../config/logger');
const { createClient } = require('@supabase/supabase-js');

// Security headers
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", config.SUPABASE_URL || 'https://*.supabase.co']
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

// JWT validation middleware for Supabase tokens
const validateJWT = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Authorization header required',
                    code: 'NO_AUTH_HEADER'
                },
                timestamp: new Date().toISOString()
            });
        }

        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : authHeader;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Bearer token required',
                    code: 'NO_TOKEN'
                },
                timestamp: new Date().toISOString()
            });
        }

        // Basic JWT format validation
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Invalid JWT format',
                    code: 'INVALID_JWT_FORMAT'
                },
                timestamp: new Date().toISOString()
            });
        }

        try {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            
            // Check if token is expired
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return res.status(401).json({
                    success: false,
                    error: {
                        message: 'Token has expired',
                        code: 'TOKEN_EXPIRED'
                    },
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Invalid JWT payload',
                    code: 'INVALID_JWT_PAYLOAD'
                },
                timestamp: new Date().toISOString()
            });
        }

        next();
    } catch (error) {
        logger.error('JWT validation error', {
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });
        
        return res.status(500).json({
            success: false,
            error: {
                message: 'Token validation error',
                code: 'JWT_VALIDATION_ERROR'
            },
            timestamp: new Date().toISOString()
        });
    }
};

// User-specific rate limiting
const createUserRateLimit = (maxRequests = 30, windowMinutes = 15) => {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        max: maxRequests,
        keyGenerator: (req) => {
            return req.user ? `user_${req.user.id}` : `ip_${req.ip}`;
        },
        message: {
            success: false,
            error: {
                message: `Przekroczono limit ${maxRequests} requestów na ${windowMinutes} minut`,
                code: 'RATE_LIMIT_EXCEEDED'
            },
            timestamp: new Date().toISOString()
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            const identifier = req.user ? `user ${req.user.id}` : `IP ${req.ip}`;
            logger.warn('User rate limit exceeded', { 
                identifier,
                userAgent: req.get('User-Agent'),
                endpoint: req.path
            });
            res.status(429).json({
                success: false,
                error: {
                    message: `Przekroczono limit ${maxRequests} requestów na ${windowMinutes} minut`,
                    code: 'RATE_LIMIT_EXCEEDED'
                },
                timestamp: new Date().toISOString()
            });
        }
    });
};

module.exports = {
    securityHeaders,
    rateLimiter,
    validateURL,
    validateText,
    sanitizeInput,
    validateJWT,
    createUserRateLimit
};