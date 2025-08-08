const crypto = require('crypto');

/**
 * Generate cache key from URL
 */
const generateCacheKey = (url, prefix = 'rss') => {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    return `${prefix}:${hash}`;
};

/**
 * Escape HTML for security
 */
const escapeHtml = (text) => {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Truncate text to specified length
 */
const truncateText = (text, maxLength = 200) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
};

/**
 * Format date to Polish locale
 */
const formatDate = (dateString) => {
    if (!dateString) return 'Brak daty';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pl-PL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
};

/**
 * Check if API key is configured
 */
const isApiKeyConfigured = (apiKey) => {
    return apiKey && 
           apiKey !== 'your_deepl_key_here' && 
           apiKey !== 'your_openai_key_here' &&
           apiKey.length > 10;
};

/**
 * Create response object
 */
const createResponse = (success, data = null, error = null, metadata = {}) => {
    return {
        success,
        timestamp: new Date().toISOString(),
        ...metadata,
        ...(data && { data }),
        ...(error && { error })
    };
};

/**
 * Validate and normalize URL
 */
const normalizeUrl = (url) => {
    if (!url) return null;
    
    try {
        const urlObj = new URL(url);
        // Force HTTPS for security
        if (urlObj.protocol === 'http:') {
            urlObj.protocol = 'https:';
        }
        return urlObj.toString();
    } catch (e) {
        return null;
    }
};

module.exports = {
    generateCacheKey,
    escapeHtml,
    truncateText,
    formatDate,
    isApiKeyConfigured,
    createResponse,
    normalizeUrl
};