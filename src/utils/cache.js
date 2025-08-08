const NodeCache = require('node-cache');
const config = require('../config/env');
const logger = require('../config/logger');

class CacheService {
    constructor() {
        this.cache = new NodeCache({ 
            stdTTL: config.CACHE_TTL,
            checkperiod: 60 // check expired keys every 60 seconds
        });
        
        this.cache.on('expired', (key, value) => {
            logger.debug('Cache key expired', { key });
        });
    }
    
    get(key) {
        try {
            const value = this.cache.get(key);
            if (value !== undefined) {
                logger.debug('Cache hit', { key });
                return value;
            }
            logger.debug('Cache miss', { key });
            return null;
        } catch (error) {
            logger.error('Cache get error', { key, error: error.message });
            return null;
        }
    }
    
    set(key, value, ttl = config.CACHE_TTL) {
        try {
            const success = this.cache.set(key, value, ttl);
            if (success) {
                logger.debug('Cache set', { key, ttl });
            }
            return success;
        } catch (error) {
            logger.error('Cache set error', { key, error: error.message });
            return false;
        }
    }
    
    del(key) {
        try {
            return this.cache.del(key);
        } catch (error) {
            logger.error('Cache delete error', { key, error: error.message });
            return 0;
        }
    }
    
    flush() {
        try {
            this.cache.flushAll();
            logger.info('Cache flushed');
        } catch (error) {
            logger.error('Cache flush error', { error: error.message });
        }
    }
    
    getStats() {
        return this.cache.getStats();
    }
}

module.exports = new CacheService();