const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');
const logger = require('../config/logger');

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'No authorization header provided',
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
                    message: 'No token provided',
                    code: 'NO_TOKEN'
                },
                timestamp: new Date().toISOString()
            });
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            logger.warn('Authentication failed', { 
                error: error?.message, 
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Invalid or expired token',
                    code: 'INVALID_TOKEN'
                },
                timestamp: new Date().toISOString()
            });
        }

        req.user = user;
        req.token = token; // Add raw token for authenticated Supabase operations
        req.supabase = supabase;
        
        logger.info('User authenticated', {
            userId: user.id,
            email: user.email,
            ip: req.ip
        });
        
        next();
    } catch (error) {
        logger.error('Authentication middleware error', {
            error: error.message,
            stack: error.stack,
            ip: req.ip
        });
        
        return res.status(500).json({
            success: false,
            error: {
                message: 'Authentication service error',
                code: 'AUTH_SERVICE_ERROR'
            },
            timestamp: new Date().toISOString()
        });
    }
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            req.user = null;
            req.supabase = supabase;
            return next();
        }

        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.substring(7) 
            : authHeader;

        if (!token) {
            req.user = null;
            req.supabase = supabase;
            return next();
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            req.user = null;
        } else {
            req.user = user;
            logger.info('User optionally authenticated', {
                userId: user.id,
                email: user.email
            });
        }
        
        req.supabase = supabase;
        next();
    } catch (error) {
        logger.error('Optional auth middleware error', {
            error: error.message,
            stack: error.stack
        });
        
        req.user = null;
        req.supabase = supabase;
        next();
    }
};

const checkSupabaseConnection = async () => {
    try {
        if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
            throw new Error('Supabase configuration missing');
        }
        
        const { data, error } = await supabase.auth.getSession();
        
        if (error && error.message !== 'Invalid JWT') {
            throw error;
        }
        
        return true;
    } catch (error) {
        logger.error('Supabase connection check failed', {
            error: error.message,
            url: config.SUPABASE_URL ? 'configured' : 'missing',
            key: config.SUPABASE_ANON_KEY ? 'configured' : 'missing'
        });
        return false;
    }
};

module.exports = {
    authenticateUser,
    optionalAuth,
    checkSupabaseConnection,
    supabase
};