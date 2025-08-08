const { Translator } = require('deepl-node');
const logger = require('../config/logger');
const config = require('../config/env');
const { isApiKeyConfigured } = require('../utils/helpers');

class TranslationService {
    constructor() {
        this.translator = null;
        this.configured = false;
        
        if (isApiKeyConfigured(config.DEEPL_API_KEY)) {
            try {
                this.translator = new Translator(config.DEEPL_API_KEY);
                this.configured = true;
                logger.info('DeepL translation service initialized');
            } catch (error) {
                logger.error('DeepL initialization failed', { error: error.message });
            }
        } else {
            logger.warn('DeepL API key not configured');
        }
    }
    
    isConfigured() {
        return this.configured;
    }
    
    async translate(text, targetLang = 'PL', sourceLang = null) {
        if (!this.configured) {
            throw new Error('Translation service not configured');
        }
        
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            throw new Error('Invalid text for translation');
        }
        
        if (text.length > config.MAX_TEXT_LENGTH) {
            throw new Error(`Text too long for translation (max ${config.MAX_TEXT_LENGTH} characters)`);
        }
        
        const startTime = Date.now();
        
        try {
            logger.debug('Translating text', { 
                textLength: text.length,
                sourceLang,
                targetLang 
            });
            
            const result = await this.translator.translateText(text, sourceLang, targetLang);
            
            const duration = Date.now() - startTime;
            logger.debug('Translation completed', { 
                originalLength: text.length,
                translatedLength: result.text.length,
                duration
            });
            
            return {
                text: result.text,
                detectedSourceLang: result.detectedSourceLang,
                targetLang
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Translation failed', { 
                error: error.message,
                textLength: text.length,
                duration
            });
            
            // Map specific DeepL errors
            let errorMessage = 'Błąd tłumaczenia';
            let statusCode = 500;
            
            if (error.message.includes('403') || error.message.includes('Forbidden')) {
                errorMessage = 'Nieprawidłowy klucz DeepL API';
                statusCode = 401;
            } else if (error.message.includes('456') || error.message.includes('quota')) {
                errorMessage = 'Przekroczono limit tłumaczeń DeepL';
                statusCode = 429;
            } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
                errorMessage = 'Nieprawidłowe parametry tłumaczenia';
                statusCode = 400;
            } else if (error.message.includes('network') || error.message.includes('timeout')) {
                errorMessage = 'Błąd połączenia z DeepL API';
                statusCode = 503;
            }
            
            const translationError = new Error(errorMessage);
            translationError.statusCode = statusCode;
            translationError.originalError = error;
            throw translationError;
        }
    }
    
    async getUsage() {
        if (!this.configured) {
            return null;
        }
        
        try {
            const usage = await this.translator.getUsage();
            logger.debug('DeepL usage retrieved', { usage });
            return usage;
        } catch (error) {
            logger.error('Failed to get DeepL usage', { error: error.message });
            return null;
        }
    }
}

module.exports = new TranslationService();