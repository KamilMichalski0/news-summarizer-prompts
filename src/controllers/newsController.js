const rssService = require('../services/rssService');
const translationService = require('../services/translationService');
const summaryService = require('../services/summaryService');
const userService = require('../services/userService');
const logger = require('../config/logger');
const { createResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

class NewsController {
    // GET /api/news - Get user's personalized news from their RSS feeds
    getNews = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const userId = req.user.id;
        
        try {
            // Get user's RSS feeds
            const userFeeds = await userService.getUserFeeds(userId, req.token);
            
            if (userFeeds.length === 0) {
                return res.json(createResponse(true, {
                    articles: [],
                    message: 'No RSS feeds configured. Add feeds to get personalized news.'
                }, null, {
                    feedsCount: 0,
                    processingTime: Date.now() - startTime
                }));
            }
            
            // Get user preferences
            const profile = await userService.getUserProfile(userId);
            const maxArticles = profile?.preferences?.max_articles || 6;
            const shouldTranslate = profile?.preferences?.auto_translate !== false;
            const shouldSummarize = profile?.preferences?.auto_summarize !== false;
            
            // Process all user feeds
            const results = [];
            for (const feed of userFeeds.slice(0, 5)) { // Limit to 5 feeds to prevent overload
                try {
                    let result;
                    
                    // Use translation/summarization pipeline if enabled
                    if (shouldTranslate || shouldSummarize) {
                        result = await rssService.processCustomRSS(
                            feed.rss_url, 
                            shouldTranslate ? translationService : null,
                            shouldSummarize ? summaryService : null
                        );
                        // Convert to expected format
                        result.articles = result.articles.map((article, index) => ({
                            id: index,
                            title: article.translatedTitle || article.originalTitle,
                            description: article.translatedContent || article.originalContent,
                            link: article.link,
                            pubDate: article.pubDate,
                            originalLang: 'en',
                            translatedTitle: article.translatedTitle,
                            originalTitle: article.originalTitle,
                            translatedContent: article.translatedContent,
                            originalContent: article.originalContent,
                            summary: article.summary
                        }));
                    } else {
                        result = await rssService.fetchRSSFeed(feed.rss_url);
                    }
                    
                    results.push({
                        feedName: feed.custom_name,
                        feedUrl: feed.rss_url,
                        articles: result.articles
                    });
                } catch (feedError) {
                    logger.warn('Failed to fetch feed', {
                        userId,
                        feedUrl: feed.rss_url,
                        error: feedError.message
                    });
                }
            }
            
            // Combine and limit articles
            const allArticles = results.flatMap(r => r.articles.map(article => ({
                ...article,
                sourceFeed: r.feedName
            })));
            
            // Sort by publication date and limit
            const sortedArticles = allArticles
                .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
                .slice(0, maxArticles);
            
            const duration = Date.now() - startTime;
            logger.info('User news fetched successfully', { 
                userId,
                feedsProcessed: results.length,
                totalArticles: sortedArticles.length,
                duration
            });
            
            res.json(createResponse(true, {
                articles: sortedArticles,
                feeds: results.map(r => ({ name: r.feedName, url: r.feedUrl }))
            }, null, {
                feedsProcessed: results.length,
                processingTime: duration
            }));
            
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Failed to fetch user news', { 
                userId,
                error: error.message,
                duration
            });
            
            res.status(500).json(createResponse(false, null, {
                message: 'Błąd pobierania spersonalizowanych newsów',
                details: error.message
            }));
        }
    });
    
    // POST /api/news/process - Process and save news with translation and summarization
    processNews = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const userId = req.user.id;
        const { articleUrl, translate = true, summarize = true } = req.body;
        
        if (!articleUrl) {
            return res.status(400).json(createResponse(false, null, {
                message: 'Article URL is required',
                code: 'MISSING_ARTICLE_URL'
            }));
        }
        
        try {
            logger.info('Processing article request', { userId, articleUrl });
            
            // Get user preferences
            const profile = await userService.getUserProfile(userId);
            const shouldTranslate = profile?.preferences?.auto_translate && translate;
            const shouldSummarize = profile?.preferences?.auto_summarize && summarize;
            
            let result = {
                originalText: articleUrl, // This would be the article content in a real implementation
                translatedText: null,
                summary: null
            };
            
            // In a real implementation, you would fetch the article content first
            // For now, we'll use the URL as placeholder content
            let articleContent = `Content from ${articleUrl}`;
            
            // Translate if requested and configured
            if (shouldTranslate && translationService.isConfigured()) {
                try {
                    result.translatedText = await translationService.translateText(
                        articleContent, 
                        'pl'
                    );
                } catch (translationError) {
                    logger.warn('Translation failed', { userId, error: translationError.message });
                    result.translationError = translationError.message;
                }
            }
            
            // Summarize if requested and configured
            if (shouldSummarize && summaryService.isConfigured()) {
                try {
                    const textToSummarize = result.translatedText || articleContent;
                    result.summary = await summaryService.generateSummary(textToSummarize);
                    
                    // Save summary to user's collection
                    if (result.summary) {
                        await userService.saveSummary(userId, articleUrl, result.summary, {
                            title: `Article from ${new URL(articleUrl).hostname}`,
                            url: articleUrl
                        });
                    }
                } catch (summaryError) {
                    logger.warn('Summarization failed', { userId, error: summaryError.message });
                    result.summaryError = summaryError.message;
                }
            }
            
            // Add to reading history
            await userService.addToReadingHistory(userId, articleUrl);
            
            const duration = Date.now() - startTime;
            logger.info('Article processed successfully', { 
                userId,
                articleUrl,
                translated: !!result.translatedText,
                summarized: !!result.summary,
                duration
            });
            
            res.json(createResponse(true, result, null, {
                processingTime: duration,
                servicesUsed: {
                    translation: shouldTranslate && translationService.isConfigured(),
                    summarization: shouldSummarize && summaryService.isConfigured()
                }
            }));
            
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Article processing failed', { 
                userId,
                articleUrl,
                error: error.message,
                duration
            });
            
            res.status(500).json(createResponse(false, null, {
                message: 'Błąd przetwarzania artykułu',
                details: error.message
            }));
        }
    });
}

module.exports = new NewsController();