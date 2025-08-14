const config = require('../config/env');
const translationService = require('../services/translationService');
const summaryService = require('../services/summaryService');
const cache = require('../utils/cache');
const logger = require('../config/logger');
const { createResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

class StatusController {
    // GET /api/status - API keys and services status
    getStatus = asyncHandler(async (req, res) => {
        try {
            const status = {
                deepl: translationService.isConfigured(),
                openai: summaryService.isConfigured(),
                supabase: config.SUPABASE_URL && config.SUPABASE_ANON_KEY,
                services: {
                    rss: true, // RSS parser doesn't need API key
                    translation: translationService.isConfigured(),
                    summarization: summaryService.isConfigured(),
                    authentication: config.SUPABASE_URL && config.SUPABASE_ANON_KEY,
                    cache: true
                },
                environment: config.NODE_ENV,
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            };
            
            // Don't expose detailed status in production for security
            if (config.NODE_ENV === 'production') {
                res.json({
                    status: 'ok',
                    services: {
                        available: Object.values(status.services).filter(Boolean).length,
                        total: Object.keys(status.services).length
                    }
                });
            } else {
                res.json(createResponse(true, status));
            }
            
        } catch (error) {
            logger.error('Status check failed', { error: error.message });
            res.status(500).json(createResponse(false, null, {
                message: 'Błąd sprawdzania statusu'
            }));
        }
    });
    
    // GET /health - Health check endpoint
    getHealth = asyncHandler(async (req, res) => {
        try {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cache: cache.getStats()
            };
            
            res.json(health);
            
        } catch (error) {
            logger.error('Health check failed', { error: error.message });
            res.status(503).json({
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    });
    
    // GET /api/metrics - Application metrics (development only)
    getMetrics = asyncHandler(async (req, res) => {
        if (config.NODE_ENV === 'production') {
            return res.status(404).json({ error: 'Endpoint not available in production' });
        }
        
        try {
            const metrics = {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                cache: cache.getStats(),
                environment: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch
                },
                services: {
                    deepl: translationService.isConfigured(),
                    openai: summaryService.isConfigured(),
                    cache: true,
                    rss: true
                }
            };
            
            res.json(createResponse(true, metrics));
            
        } catch (error) {
            logger.error('Metrics retrieval failed', { error: error.message });
            res.status(500).json(createResponse(false, null, {
                message: 'Błąd pobierania metryk'
            }));
        }
    });
}

module.exports = new StatusController();