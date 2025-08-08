const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const RSSParser = require('rss-parser');
const { Translator } = require('deepl-node');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serwowanie plików statycznych z katalogu public
app.use(express.static(path.join(__dirname, 'public')));

// Inicjalizacja RSS Parser
const parser = new RSSParser();

// Inicjalizacja DeepL Translator
const translator = new Translator(process.env.DEEPL_API_KEY);

// Inicjalizacja OpenAI Client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Endpoint główny - serwuje index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint do pobierania i przetwarzania newsów
app.post('/api/news', async (req, res) => {
    try {
        const { rssUrl } = req.body;
        
        if (!rssUrl) {
            return res.status(400).json({ error: 'RSS URL jest wymagany' });
        }

        // 1. Pobierz RSS feed
        console.log('Pobieranie RSS feed z:', rssUrl);
        const feed = await parser.parseURL(rssUrl);
        
        // Weź pierwsze 5 artykułów
        const articles = feed.items.slice(0, 5);
        
        const processedArticles = [];
        
        for (const article of articles) {
            try {
                console.log('Przetwarzanie artykułu:', article.title);
                
                // 2. Tłumacz tytuł i opis na polski
                let translatedTitle = article.title;
                let translatedContent = article.contentSnippet || article.summary || '';
                
                if (process.env.DEEPL_API_KEY && process.env.DEEPL_API_KEY !== 'your_deepl_key_here') {
                    try {
                        const titleResult = await translator.translateText(article.title, null, 'PL');
                        translatedTitle = titleResult.text;
                        
                        if (translatedContent) {
                            const contentResult = await translator.translateText(translatedContent, null, 'PL');
                            translatedContent = contentResult.text;
                        }
                    } catch (translateError) {
                        console.warn('Błąd tłumaczenia:', translateError.message);
                    }
                }
                
                // 3. Stwórz streszczenie za pomocą OpenAI
                let summary = 'Streszczenie niedostępne (brak klucza OpenAI)';
                
                if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_key_here') {
                    try {
                        const prompt = `Stwórz krótkie streszczenie (2-3 zdania) tego artykułu w języku polskim:
                        
Tytuł: ${translatedTitle}
Treść: ${translatedContent}`;

                        const completion = await openai.chat.completions.create({
                            model: "gpt-3.5-turbo",
                            messages: [
                                {
                                    role: "system",
                                    content: "Jesteś pomocnym asystentem, który tworzy krótkie i zwięzłe streszczenia artykułów w języku polskim."
                                },
                                {
                                    role: "user",
                                    content: prompt
                                }
                            ],
                            max_tokens: 150,
                            temperature: 0.3
                        });
                        
                        summary = completion.choices[0].message.content;
                    } catch (summaryError) {
                        console.warn('Błąd streszczania:', summaryError.message);
                        summary = 'Nie udało się wygenerować streszczenia';
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
                console.error('Błąd przetwarzania artykułu:', articleError.message);
            }
        }
        
        res.json({
            feedTitle: feed.title,
            feedLink: feed.link,
            articles: processedArticles
        });
        
    } catch (error) {
        console.error('Błąd pobierania newsów:', error.message);
        res.status(500).json({ error: 'Błąd pobierania newsów: ' + error.message });
    }
});

// GET endpoint do automatycznego pobierania newsów z BBC
app.get('/api/news', async (req, res) => {
    try {
        // Dodaj header Cache-Control: no-cache
        res.set('Cache-Control', 'no-cache');
        
        const rssUrl = 'https://feeds.bbci.co.uk/news/world/rss.xml';
        
        console.log('Pobieranie RSS feed z:', rssUrl);
        const feed = await parser.parseURL(rssUrl);
        
        // Filtruj artykuły które mają contentSnippet lub content
        const articlesWithContent = feed.items.filter(item => 
            item.contentSnippet || item.content
        );
        
        // Weź pierwsze 6 artykułów
        const selectedArticles = articlesWithContent.slice(0, 6);
        
        console.log(`Znaleziono ${selectedArticles.length} artykułów z treścią`);
        
        const processedArticles = selectedArticles.map((item, index) => {
            let description = item.contentSnippet || item.content || 'Brak opisu';
            
            // Ogranicz description do maksymalnie 200 znaków
            if (description.length > 200) {
                description = description.substring(0, 200).trim() + '...';
            }
            
            return {
                id: index,
                title: item.title,
                description: description,
                link: item.link,
                pubDate: item.pubDate,
                originalLang: 'en'
            };
        });
        
        res.json({
            feedTitle: feed.title,
            feedLink: feed.link,
            articles: processedArticles,
            totalFound: selectedArticles.length
        });
        
    } catch (error) {
        console.error('Błąd pobierania RSS:', error.message);
        res.status(500).json({ 
            error: 'Błąd pobierania newsów z RSS',
            message: error.message 
        });
    }
});

// POST endpoint do tłumaczenia tekstu
app.post('/api/translate', async (req, res) => {
    try {
        const { text, sourceLang, targetLang } = req.body;
        
        // Sprawdź czy text nie jest pusty
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Tekst jest wymagany i nie może być pusty' 
            });
        }
        
        // Limit input tekstu do 1000 znaków dla bezpieczeństwa
        if (text.length > 1000) {
            return res.status(400).json({ 
                error: 'Tekst nie może być dłuższy niż 1000 znaków' 
            });
        }
        
        // Sprawdź czy klucz DeepL API jest dostępny
        if (!process.env.DEEPL_API_KEY || process.env.DEEPL_API_KEY === 'your_deepl_key_here') {
            return res.status(400).json({ 
                error: 'Klucz DeepL API nie jest skonfigurowany' 
            });
        }
        
        console.log(`Tłumaczenie tekstu: ${text.length} znaków (${sourceLang} → ${targetLang})`);
        
        // Wywołaj translator.translateText
        const result = await translator.translateText(text, sourceLang, targetLang);
        
        console.log(`Tekst przetłumaczony: ${result.text.length} znaków`);
        
        res.json({ 
            translatedText: result.text 
        });
        
    } catch (error) {
        console.error('Błąd tłumaczenia DeepL:', error.message);
        
        // Catch błędy DeepL API
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
        
        res.status(statusCode).json({ 
            error: errorMessage,
            details: error.message 
        });
    }
});

// API endpoint do sprawdzenia statusu kluczy API
app.get('/api/status', (req, res) => {
    res.json({
        deepl: process.env.DEEPL_API_KEY && process.env.DEEPL_API_KEY !== 'your_deepl_key_here',
        openai: process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_key_here'
    });
});

// Uruchomienie serwera
app.listen(PORT, () => {
    console.log(`Serwer News Summarizer uruchomiony na porcie ${PORT}`);
    console.log(`Otwórz przeglądarkę na http://localhost:${PORT}`);
    
    // Sprawdź status kluczy API
    const deeplStatus = process.env.DEEPL_API_KEY && process.env.DEEPL_API_KEY !== 'your_deepl_key_here';
    const openaiStatus = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_key_here';
    
    console.log('Status kluczy API:');
    console.log('- DeepL:', deeplStatus ? '✓ Skonfigurowany' : '✗ Brak klucza');
    console.log('- OpenAI:', openaiStatus ? '✓ Skonfigurowany' : '✗ Brak klucza');
});