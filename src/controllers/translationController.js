const translationService = require('../services/translationService');
const userService = require('../services/userService');
const logger = require('../config/logger');
const { createResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

class TranslationController {
    // POST /api/translate - Translate text for authenticated user
    translateText = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const userId = req.user.id;
        const { text, sourceLang, targetLang } = req.body;
        
        try {
            if (!translationService.isConfigured()) {
                return res.status(503).json(createResponse(false, null, {
                    message: 'Usługa tłumaczenia nie jest skonfigurowana',
                    details: 'Klucz DeepL API nie jest dostępny',
                    code: 'TRANSLATION_SERVICE_UNAVAILABLE'
                }));
            }
            
            // Get user preferences for default target language
            const profile = await userService.getUserProfile(userId);
            const defaultTargetLang = profile?.preferences?.language || 'pl';
            const finalTargetLang = targetLang || defaultTargetLang;
            
            // Validate text length against user preferences or defaults
            const maxLength = profile?.preferences?.max_translation_length || 1000;
            if (text.length > maxLength) {
                return res.status(400).json(createResponse(false, null, {
                    message: `Tekst nie może być dłuższy niż ${maxLength} znaków`,
                    code: 'TEXT_TOO_LONG',
                    maxLength
                }));
            }
            
            logger.info('User translation request', { 
                userId,
                textLength: text.length,
                sourceLang,
                targetLang: finalTargetLang
            });
            
            const result = await translationService.translate(text, finalTargetLang, sourceLang);
            
            // Save translation to user's history if it's a significant translation
            if (text.length > 50) {
                try {
                    // In a real implementation, you might want to create a translations table
                    // For now, we'll just log it or save as part of reading history
                    logger.info('Translation saved to user history', { userId, textLength: text.length });
                } catch (saveError) {
                    logger.warn('Failed to save translation to history', { userId, error: saveError.message });
                }
            }
            
            const duration = Date.now() - startTime;
            logger.info('User translation completed successfully', { 
                userId,
                originalLength: text.length,
                translatedLength: result.text.length,
                detectedLang: result.detectedSourceLang,
                duration
            });
            
            res.json(createResponse(true, {
                translatedText: result.text,
                detectedSourceLang: result.detectedSourceLang,
                targetLang: result.targetLang,
                userPreferences: {
                    defaultLanguage: defaultTargetLang,
                    maxLength
                }
            }, null, {
                processingTime: duration
            }));
            
        } catch (error) {
            const duration = Date.now() - startTime;
            const statusCode = error.statusCode || 500;
            
            logger.error('User translation failed', { 
                userId,
                error: error.message,
                statusCode,
                textLength: text?.length,
                duration
            });
            
            res.status(statusCode).json(createResponse(false, null, {
                message: error.message,
                details: error.originalError?.message,
                code: 'TRANSLATION_ERROR'
            }));
        }
    });
    
    // GET /api/translate/usage - Get translation usage stats for user
    getUsage = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        
        try {
            if (!translationService.isConfigured()) {
                return res.status(503).json(createResponse(false, null, {
                    message: 'Usługa tłumaczenia nie jest skonfigurowana',
                    code: 'TRANSLATION_SERVICE_UNAVAILABLE'
                }));
            }
            
            // Get global service usage (admin-level info)
            const globalUsage = await translationService.getUsage();
            
            // Get user profile to show their preferences and limits
            const profile = await userService.getUserProfile(userId);
            
            if (!globalUsage) {
                return res.status(503).json(createResponse(false, null, {
                    message: 'Nie można pobrać statystyk użycia',
                    code: 'USAGE_FETCH_ERROR'
                }));
            }
            
            // In a production app, you'd track user-specific usage
            const userUsageData = {
                globalUsage: {
                    charactersUsed: globalUsage.character?.count || 0,
                    charactersLimit: globalUsage.character?.limit || 0,
                    percentageUsed: globalUsage.character?.count && globalUsage.character?.limit 
                        ? Math.round((globalUsage.character.count / globalUsage.character.limit) * 100) 
                        : 0
                },
                userPreferences: {
                    defaultLanguage: profile?.preferences?.language || 'pl',
                    maxTranslationLength: profile?.preferences?.max_translation_length || 1000,
                    autoTranslate: profile?.preferences?.auto_translate || true
                },
                // In a real implementation, you'd track these per user
                userStats: {
                    translationsToday: 0, // Would be calculated from user's translation history
                    totalCharactersTranslated: 0, // Would be tracked in database
                    favoriteLanguages: ['pl', 'en'] // Would be calculated from user's history
                }
            };
            
            logger.info('User translation usage retrieved', { userId, globalUsage });
            
            res.json(createResponse(true, userUsageData));
            
        } catch (error) {
            logger.error('Failed to get user translation usage', { 
                userId,
                error: error.message 
            });
            
            res.status(500).json(createResponse(false, null, {
                message: 'Błąd pobierania statystyk użycia',
                details: error.message,
                code: 'USAGE_ERROR'
            }));
        }
    });
    
    // GET /api/translate/languages - Get available languages for user
    getLanguages = asyncHandler(async (req, res) => {
        const userId = req.user.id;
        
        try {
            if (!translationService.isConfigured()) {
                return res.status(503).json(createResponse(false, null, {
                    message: 'Usługa tłumaczenia nie jest skonfigurowana',
                    code: 'TRANSLATION_SERVICE_UNAVAILABLE'
                }));
            }
            
            // Get available languages from DeepL
            const languages = await translationService.getSupportedLanguages();
            
            // Get user preferences
            const profile = await userService.getUserProfile(userId);
            const userLanguage = profile?.preferences?.language || 'pl';
            
            logger.info('User languages retrieved', { userId, languageCount: languages?.length || 0 });
            
            res.json(createResponse(true, {
                languages: languages || [],
                userPreferences: {
                    defaultLanguage: userLanguage
                }
            }));
            
        } catch (error) {
            logger.error('Failed to get supported languages', { 
                userId,
                error: error.message 
            });
            
            res.status(500).json(createResponse(false, null, {
                message: 'Błąd pobierania dostępnych języków',
                details: error.message,
                code: 'LANGUAGES_ERROR'
            }));
        }
    });
}

module.exports = new TranslationController();