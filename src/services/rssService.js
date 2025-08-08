const RSSParser = require('rss-parser');
const logger = require('../config/logger');
const config = require('../config/env');
const cache = require('../utils/cache');
const { generateCacheKey, truncateText } = require('../utils/helpers');

class RSSService {
    constructor() {
        this.parser = new RSSParser({
            timeout: 10000,
            maxRedirects: 5
        });
    }
    
    async fetchRSSFeed(url) {
        const startTime = Date.now();
        const cacheKey = generateCacheKey(url);
        
        try {
            // Check cache first
            const cachedFeed = cache.get(cacheKey);
            if (cachedFeed) {
                logger.info('RSS feed served from cache', { url });
                return cachedFeed;
            }
            
            logger.info('Fetching RSS feed', { url });
            
            const feed = await this.parser.parseURL(url);
            
            // Filter and process articles
            const articlesWithContent = feed.items.filter(item => 
                item.contentSnippet || item.content || item.description
            );
            
            const processedArticles = articlesWithContent
                .slice(0, config.MAX_ARTICLES)
                .map((item, index) => {
                    let description = item.contentSnippet || 
                                    item.content || 
                                    item.description || 
                                    'Brak opisu';
                    
                    description = truncateText(description, 200);
                    
                    return {
                        id: index,
                        title: item.title || 'Bez tytułu',
                        description,
                        link: item.link,
                        pubDate: item.pubDate || item.isoDate,
                        originalLang: 'en'
                    };
                });
            
            const result = {
                feedTitle: feed.title || 'RSS Feed',
                feedLink: feed.link,
                articles: processedArticles,
                totalFound: processedArticles.length,
                fetchedAt: new Date().toISOString()
            };
            
            // Cache the result
            cache.set(cacheKey, result);
            
            const duration = Date.now() - startTime;
            logger.info('RSS feed processed successfully', { 
                url, 
                articlesCount: processedArticles.length,
                duration 
            });
            
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('RSS feed fetch failed', { 
                url, 
                error: error.message,
                duration 
            });
            
            throw new Error(`Błąd pobierania RSS feed: ${error.message}`);
        }
    }
    
    async processCustomRSS(url, translationService, summaryService) {
        const startTime = Date.now();
        
        try {
            logger.info('Processing custom RSS with full pipeline', { url });
            
            const feed = await this.parser.parseURL(url);
            const articles = feed.items.slice(0, 5); // Limit for processing
            
            const processedArticles = [];
            
            for (const article of articles) {
                try {
                    logger.debug('Processing article', { title: article.title });
                    
                    let translatedTitle = article.title;
                    let translatedContent = article.contentSnippet || article.summary || '';
                    let summary = 'Streszczenie niedostępne';
                    
                    // Translation
                    if (translationService && translationService.isConfigured()) {
                        try {
                            const titleResult = await translationService.translate(article.title, 'PL');
                            translatedTitle = titleResult.text;
                            
                            if (translatedContent) {
                                const contentResult = await translationService.translate(translatedContent, 'PL');
                                translatedContent = contentResult.text;
                            }
                        } catch (translateError) {
                            logger.warn('Translation failed for article', { 
                                title: article.title,
                                error: translateError.message 
                            });
                        }
                    }
                    
                    // Summarization
                    if (summaryService && summaryService.isConfigured()) {
                        try {
                            summary = await summaryService.generateSummary(
                                translatedTitle, 
                                translatedContent
                            );
                        } catch (summaryError) {
                            logger.warn('Summarization failed for article', {
                                title: article.title,
                                error: summaryError.message
                            });
                        }
                    }
                    
                    processedArticles.push({
                        originalTitle: article.title,
                        translatedTitle,
                        originalContent: article.contentSnippet || article.summary || '',
                        translatedContent,
                        summary,
                        link: article.link,
                        pubDate: article.pubDate
                    });
                    
                } catch (articleError) {
                    logger.error('Article processing failed', {
                        title: article.title,
                        error: articleError.message
                    });
                }
            }
            
            const duration = Date.now() - startTime;
            logger.info('Custom RSS processing completed', {
                url,
                articlesProcessed: processedArticles.length,
                duration
            });
            
            return {
                feedTitle: feed.title,
                feedLink: feed.link,
                articles: processedArticles
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Custom RSS processing failed', {
                url,
                error: error.message,
                duration
            });
            throw error;
        }
    }
}

module.exports = new RSSService();