# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

News Summarizer is a full-stack web application that automatically fetches RSS feeds, translates articles to Polish, and generates AI summaries. Built with Express.js backend and vanilla JavaScript frontend, following enterprise-grade security and modular architecture patterns.

### Core Architecture (Post-Refactoring)

**Backend (Modular Architecture):**
- **server.js** - Main application entry point with security middleware
- **src/config/** - Configuration management and logging
  - `env.js` - Environment variables and application settings
  - `logger.js` - Winston-based structured logging
- **src/controllers/** - HTTP request handlers
  - `newsController.js` - RSS processing and news endpoints
  - `translationController.js` - DeepL translation service
  - `statusController.js` - Health checks and API status
- **src/services/** - Business logic layer
  - `rssService.js` - RSS parsing and processing
  - `translationService.js` - DeepL API integration
  - `summaryService.js` - OpenAI GPT integration
- **src/middleware/** - Cross-cutting concerns
  - `security.js` - Input validation, rate limiting, SSRF protection
  - `errorHandler.js` - Global error handling and logging
- **src/utils/** - Helper functions and utilities
  - `cache.js` - NodeCache service for RSS feed caching
  - `helpers.js` - Common utility functions

**Frontend (public/):**
- `index.html` - Single-page application with responsive design
- `script.js` - NewsApp object managing UI state and API calls (updated for new API format)
- `style.css` - Modern CSS with gradients, animations, and responsive breakpoints

**External APIs Integration:**
- RSS Parser for feed processing (6 articles max with content filtering)
- DeepL API for text translation (1000 char limit)
- OpenAI GPT-3.5-turbo for article summarization
- NodeCache for RSS feed caching (5min TTL)

## Development Commands

### Starting the Application
```bash
# Install dependencies
npm install

# Development with auto-reload
npm run dev

# Production
npm start
```

### Environment Setup
Configure API keys in `.env`:
- `DEEPL_API_KEY` - DeepL translation service
- `OPENAI_API_KEY` - OpenAI for summarization
- `PORT` - Server port (default 3000)
- `NODE_ENV` - Environment mode (development/production)

### Dependencies
**Production:**
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `helmet` - Security headers middleware
- `express-rate-limit` - Rate limiting protection
- `validator` - Input validation and sanitization
- `winston` - Structured logging
- `node-cache` - In-memory caching
- `rss-parser` - RSS feed parsing
- `deepl-node` - DeepL translation API
- `openai` - OpenAI API integration
- `dotenv` - Environment configuration

**Development:**
- `nodemon` - Auto-restart development server

## Key Implementation Details

### RSS Processing Pipeline (src/services/rssService.js)
1. Parse RSS feed using rss-parser with timeout (10s) and redirect limits
2. Filter articles with contentSnippet or content
3. Cache RSS feeds (5min TTL) to reduce API calls
4. Limit descriptions to 200 characters
5. Translate titles/content via DeepL API (if configured)
6. Generate summaries with OpenAI GPT-3.5-turbo (if configured)

### Security Architecture (src/middleware/security.js)
- **SSRF Protection**: Domain whitelist (BBC, CNN, Reuters, Guardian, TechCrunch)
- **Rate Limiting**: 100 req/15min (dev), 50 req/15min (prod)
- **Input Validation**: URL format validation, text length limits (1000 chars)
- **Content Security Policy**: Helmet.js with restrictive CSP headers
- **CORS Configuration**: Environment-specific origin restrictions
- **Input Sanitization**: HTML escaping for all user inputs

### Error Handling Strategy (src/middleware/errorHandler.js)
- **Structured Logging**: Winston with JSON format, file rotation
- **Global Error Handling**: Uncaught exceptions and promise rejections
- **API Error Mapping**: DeepL/OpenAI errors to meaningful HTTP status codes
- **Graceful Degradation**: Service unavailable fallbacks
- **Environment Awareness**: Error details hidden in production

### Frontend State Management (public/script.js)
- NewsApp object handles all application state
- **New API Format Compatibility**: Handles both legacy and new response structures
- Progressive loading animation with 3-step process
- Responsive design with mobile-first approach
- Real-time API status monitoring (30s intervals)
- Backward compatible error handling

### Caching Strategy (src/utils/cache.js)
- **RSS Feed Caching**: 5-minute TTL with NodeCache
- **Cache Statistics**: Hit/miss tracking and memory usage
- **Automatic Cleanup**: Expired key detection and removal
- **Error Resilience**: Cache failures don't break functionality

## API Endpoints Reference

### Public Routes
- `GET /` - Serves main application (public/index.html)
- `GET /health` - Health check endpoint (no auth, no rate limiting)

### API Routes (Rate Limited)
- `GET /api/news` - Auto-fetch BBC World RSS (6 articles max, cached)
- `POST /api/news` - Custom RSS processing with translation/summarization (requires domain validation)
- `POST /api/translate` - Text translation via DeepL (requires text validation)
- `GET /api/translate/usage` - DeepL API usage statistics
- `GET /api/status` - API services status (detailed in dev, minimal in prod)
- `GET /api/metrics` - Application metrics (development only)

### API Response Format
All API endpoints now return structured responses:
```json
{
  "success": true|false,
  "timestamp": "2025-08-08T10:49:37.366Z",
  "data": { /* response data */ },
  "error": { /* error details */ },
  /* additional metadata */
}
```

### Security Features
- **Domain Whitelist**: Only allows trusted RSS domains
- **Rate Limiting**: API routes protected (15min windows)
- **Input Validation**: All user inputs validated and sanitized
- **Error Sanitization**: Production errors don't leak internal details
- **Request Logging**: All requests logged with IP and User-Agent
- **Timeout Configuration**: 30s timeout for external API calls

## File Structure (Post-Refactoring)
```
├── server.js                 # Main application entry
├── logs/                     # Winston log files (error.log, combined.log)
├── src/
│   ├── config/
│   │   ├── env.js            # Environment configuration
│   │   └── logger.js         # Winston logging setup
│   ├── controllers/
│   │   ├── newsController.js     # RSS endpoints
│   │   ├── translationController.js # Translation endpoints
│   │   └── statusController.js    # Health/status endpoints
│   ├── services/
│   │   ├── rssService.js         # RSS parsing business logic
│   │   ├── translationService.js # DeepL integration
│   │   └── summaryService.js     # OpenAI integration
│   ├── middleware/
│   │   ├── security.js           # Security middleware
│   │   └── errorHandler.js       # Error handling
│   └── utils/
│       ├── cache.js              # Caching service
│       └── helpers.js            # Utility functions
└── public/
    ├── index.html            # Frontend application
    ├── script.js             # Frontend logic (updated for new API)
    └── style.css             # Styling
```

## Development Notes

### Testing the Application
```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Test health endpoint
curl http://localhost:3000/health

# Test with rate limiting
curl -X POST http://localhost:3000/api/news \
  -H "Content-Type: application/json" \
  -d '{"rssUrl": "https://feeds.bbci.co.uk/news/rss.xml"}'
```

### Troubleshooting
1. **Frontend not showing data**: Check browser console for API response format issues
2. **Rate limiting errors**: Wait 15 minutes or restart server in development
3. **Domain not allowed**: Add domain to ALLOWED_DOMAINS in src/config/env.js
4. **Service unavailable**: Check API keys in .env file
5. **Timeout errors**: Increase timeout in service configurations

### Migration from Original
- Original monolithic architecture completely replaced with modular structure
- Frontend updated to handle new API response format
- All security features are additive - no functionality removed
- Environment variables remain the same
- Cleanup completed - no legacy files remain