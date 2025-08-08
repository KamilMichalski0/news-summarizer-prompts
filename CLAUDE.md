# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

News Summarizer is a full-stack web application that automatically fetches RSS feeds, translates articles to Polish, and generates AI summaries. Built with Express.js backend and vanilla JavaScript frontend.

### Core Architecture

**Backend (server.js):**
- Express server serving static files from `public/` directory
- Three main API endpoints:
  - `GET /api/news` - Fetches BBC World RSS feed automatically
  - `POST /api/news` - Processes custom RSS URLs with translation and summarization
  - `POST /api/translate` - DeepL translation service endpoint
  - `GET /api/status` - API key status checker

**Frontend (public/):**
- `index.html` - Single-page application with responsive design
- `script.js` - NewsApp object managing UI state and API calls
- `style.css` - Modern CSS with gradients, animations, and responsive breakpoints

**External APIs Integration:**
- RSS Parser for feed processing (6 articles max with content filtering)
- DeepL API for text translation (1000 char limit)
- OpenAI GPT-3.5-turbo for article summarization

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

## Key Implementation Details

### RSS Processing Pipeline
1. Parse RSS feed using rss-parser
2. Filter articles with contentSnippet or content
3. Limit descriptions to 200 characters
4. Translate titles/content via DeepL API
5. Generate summaries with OpenAI (2-3 sentences)

### Error Handling Strategy
- DeepL API errors mapped to specific HTTP status codes (403→401, 456→429, etc.)
- Frontend displays user-friendly error messages
- Console logging for debugging with character counts
- Graceful degradation when API keys missing

### Frontend State Management
- NewsApp object handles all application state
- Progressive loading animation with 3-step process
- Responsive design with mobile-first approach
- Real-time API status monitoring (30s intervals)

### Security Considerations
- Text input limited to 1000 characters
- HTML escaping for user content display
- CORS enabled for cross-origin requests
- Cache-Control headers for fresh data

## API Endpoints Reference

- `GET /` - Serves main application
- `GET /api/news` - Auto-fetch BBC World news (returns 6 articles max)
- `POST /api/news` - Custom RSS processing with full pipeline
- `POST /api/translate` - Text translation (text, sourceLang, targetLang)
- `GET /api/status` - Check API key configuration status