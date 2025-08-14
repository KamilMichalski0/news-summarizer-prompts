require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    DEEPL_API_KEY: process.env.DEEPL_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    
    // Supabase configuration
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    
    // Security settings
    ALLOWED_DOMAINS: [
        'feeds.bbci.co.uk',
        'rss.cnn.com', 
        'feeds.reuters.com',
        'www.theguardian.com',
        'techcrunch.com'
    ],
    
    // Rate limiting
    RATE_LIMIT: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: process.env.NODE_ENV === 'production' ? 50 : 100
    },
    
    // CORS settings
    CORS_ORIGINS: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000', 'http://localhost:8000'],
    
    // Cache settings
    CACHE_TTL: 300, // 5 minutes
    
    // Feed limits
    MAX_FEED_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_ARTICLES: 6,
    MAX_TEXT_LENGTH: 1000
};