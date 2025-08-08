const translationService = require('../services/translationService');
const logger = require('../config/logger');
const { createResponse } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

class TranslationController {
    // POST /api/translate - Translate text
    translateText = asyncHandler(async (req, res) => {
        const startTime = Date.now();
        const { text, sourceLang, targetLang } = req.body;
        
        try {
            if (!translationService.isConfigured()) {
                return res.status(503).json(createResponse(false, null, {
                    message: 'Usługa tłumaczenia nie jest skonfigurowana',
                    details: 'Klucz DeepL API nie jest dostępny'
                }));
            }
            
            logger.info('Translation request', { 
                textLength: text.length,
                sourceLang,
                targetLang 
            });
            
            const result = await translationService.translate(text, targetLang, sourceLang);
            
            const duration = Date.now() - startTime;
            logger.info('Translation completed successfully', { 
                originalLength: text.length,
                translatedLength: result.text.length,
                detectedLang: result.detectedSourceLang,
                duration
            });
            
            res.json(createResponse(true, {
                translatedText: result.text,
                detectedSourceLang: result.detectedSourceLang,
                targetLang: result.targetLang
            }, null, {
                processingTime: duration
            }));
            
        } catch (error) {
            const duration = Date.now() - startTime;
            const statusCode = error.statusCode || 500;
            
            logger.error('Translation failed', { 
                error: error.message,
                statusCode,
                textLength: text.length,
                duration
            });
            
            res.status(statusCode).json(createResponse(false, null, {
                message: error.message,
                details: error.originalError?.message
            }));
        }
    });
    
    // GET /api/translate/usage - Get translation usage stats
    getUsage = asyncHandler(async (req, res) => {
        try {
            if (!translationService.isConfigured()) {
                return res.status(503).json(createResponse(false, null, {
                    message: 'Usługa tłumaczenia nie jest skonfigurowana'
                }));
            }
            
            const usage = await translationService.getUsage();
            
            if (!usage) {
                return res.status(503).json(createResponse(false, null, {
                    message: 'Nie można pobrać statystyk użycia'
                }));
            }
            
            logger.info('Translation usage retrieved', { usage });
            
            res.json(createResponse(true, usage));
            
        } catch (error) {
            logger.error('Failed to get translation usage', { 
                error: error.message 
            });
            
            res.status(500).json(createResponse(false, null, {
                message: 'Błąd pobierania statystyk użycia',
                details: error.message
            }));
        }
    });
}

module.exports = new TranslationController();