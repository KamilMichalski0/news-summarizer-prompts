const rssService = require('../services/rssService');
const translationService = require('../services/translationService');
const summaryService = require('../services/summaryService');
const logger = require('../config/logger');
const { createResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

class NewsController {
    // GET /api/news - Fetch BBC World RSS feed automatically
    getNews = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        
        try {
            // Set cache-control header
            res.set('Cache-Control', 'no-cache');
            
            const rssUrl = 'https://feeds.bbci.co.uk/news/world/rss.xml';
            const result = await rssService.fetchRSSFeed(rssUrl);
            
            const duration = Date.now() - startTime;
            logger.info('News fetched successfully', { 
                source: 'BBC World',
                articlesCount: result.articles.length,
                duration
            });
            
            res.json(createResponse(true, result, null, {
                source: 'BBC World RSS',
                processingTime: duration
            }));
            
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Failed to fetch news', { 
                error: error.message,
                duration
            });
            
            res.status(500).json(createResponse(false, null, {
                message: 'Błąd pobierania newsów z RSS',
                details: error.message
            }));
        }
    });
    
    // POST /api/news - Process custom RSS with translation and summarization
    processNews = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const { rssUrl } = req.body;
        
        try {
            logger.info('Processing custom RSS request', { url: rssUrl });
            
            const result = await rssService.processCustomRSS(
                rssUrl, 
                translationService, 
                summaryService
            );
            
            const duration = Date.now() - startTime;
            logger.info('Custom RSS processed successfully', { 
                url: rssUrl,
                articlesProcessed: result.articles.length,
                duration
            });
            
            res.json(createResponse(true, result, null, {
                processingTime: duration,
                servicesUsed: {
                    translation: translationService.isConfigured(),
                    summarization: summaryService.isConfigured()
                }
            }));
            
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Custom RSS processing failed', { 
                url: rssUrl,
                error: error.message,
                duration
            });
            
            res.status(500).json(createResponse(false, null, {
                message: 'Błąd przetwarzania RSS',
                details: error.message
            }));
        }
    });
}

module.exports = new NewsController();