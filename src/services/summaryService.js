const OpenAI = require('openai');
const logger = require('../config/logger');
const config = require('../config/env');
const { isApiKeyConfigured } = require('../utils/helpers');

class SummaryService {
    constructor() {
        this.openai = null;
        this.configured = false;
        
        if (isApiKeyConfigured(config.OPENAI_API_KEY)) {
            try {
                this.openai = new OpenAI({
                    apiKey: config.OPENAI_API_KEY,
                });
                this.configured = true;
                logger.info('OpenAI summary service initialized');
            } catch (error) {
                logger.error('OpenAI initialization failed', { error: error.message });
            }
        } else {
            logger.warn('OpenAI API key not configured');
        }
    }
    
    isConfigured() {
        return this.configured;
    }
    
    async generateSummary(title, content) {
        if (!this.configured) {
            throw new Error('Summary service not configured');
        }
        
        if (!title && !content) {
            throw new Error('No content provided for summarization');
        }
        
        const startTime = Date.now();
        
        try {
            const prompt = `Stwórz krótkie streszczenie (2-3 zdania) tego artykułu w języku polskim:
                        
Tytuł: ${title || 'Brak tytułu'}
Treść: ${content || 'Brak treści'}`;

            logger.debug('Generating summary', { 
                titleLength: title?.length || 0,
                contentLength: content?.length || 0 
            });

            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "Jesteś pomocnym asystentem, który tworzy krótkie i zwięzłe streszczenia artykułów w języku polskim. Streszczenie powinno być obiektywne i zawierać najważniejsze informacje z artykułu."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 150,
                temperature: 0.3
            }, {
                timeout: 30000 // 30 second timeout - passed as options parameter
            });
            
            const summary = completion.choices[0]?.message?.content?.trim();
            
            if (!summary) {
                throw new Error('Empty response from OpenAI');
            }
            
            const duration = Date.now() - startTime;
            logger.debug('Summary generated successfully', { 
                summaryLength: summary.length,
                tokensUsed: completion.usage?.total_tokens,
                duration
            });
            
            return summary;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error('Summary generation failed', { 
                error: error.message,
                duration
            });
            
            // Map OpenAI specific errors
            let errorMessage = 'Błąd generowania streszczenia';
            
            if (error.code === 'insufficient_quota') {
                errorMessage = 'Przekroczono limit API OpenAI';
            } else if (error.code === 'invalid_api_key') {
                errorMessage = 'Nieprawidłowy klucz API OpenAI';
            } else if (error.code === 'rate_limit_exceeded') {
                errorMessage = 'Przekroczono limit requestów OpenAI';
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Timeout podczas generowania streszczenia';
            }
            
            const summaryError = new Error(errorMessage);
            summaryError.originalError = error;
            throw summaryError;
        }
    }
}

module.exports = new SummaryService();