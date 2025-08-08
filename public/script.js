// Główny obiekt aplikacji
const NewsApp = {
    currentStep: 0,
    
    // Inicjalizacja aplikacji
    init() {
        this.bindEvents();
        this.checkAPIStatus();
    },
    
    // Przypisanie event listenerów
    bindEvents() {
        // Formularz RSS
        const rssForm = document.getElementById('rss-form');
        rssForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.fetchNews();
        });
        
        // Przykładowe feedy
        const exampleFeeds = document.querySelectorAll('.example-feed');
        exampleFeeds.forEach(button => {
            button.addEventListener('click', () => {
                const url = button.dataset.url;
                document.getElementById('rss-url').value = url;
                this.fetchNews();
            });
        });
        
        // Przyciski akcji
        const newSearchBtn = document.getElementById('new-search-btn');
        if (newSearchBtn) {
            newSearchBtn.addEventListener('click', () => this.resetApp());
        }
        
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.fetchNews());
        }
    },
    
    // Sprawdzenie statusu API
    async checkAPIStatus() {
        try {
            const response = await fetch('/api/status');
            const status = await response.json();
            
            // Aktualizacja statusu DeepL
            const deeplStatus = document.getElementById('deepl-status');
            deeplStatus.textContent = status.deepl ? '✓ Połączony' : '✗ Brak klucza';
            deeplStatus.className = `status-indicator ${status.deepl ? 'connected' : 'disconnected'}`;
            
            // Aktualizacja statusu OpenAI
            const openaiStatus = document.getElementById('openai-status');
            openaiStatus.textContent = status.openai ? '✓ Połączony' : '✗ Brak klucza';
            openaiStatus.className = `status-indicator ${status.openai ? 'connected' : 'disconnected'}`;
            
        } catch (error) {
            console.error('Błąd sprawdzania statusu API:', error);
            document.getElementById('deepl-status').textContent = 'Błąd';
            document.getElementById('openai-status').textContent = 'Błąd';
        }
    },
    
    // Pobranie i przetworzenie newsów
    async fetchNews() {
        const rssUrl = document.getElementById('rss-url').value.trim();
        
        if (!rssUrl) {
            this.showError('Proszę wprowadzić URL RSS');
            return;
        }
        
        // Walidacja URL
        if (!this.isValidURL(rssUrl)) {
            this.showError('Proszę wprowadzić poprawny URL');
            return;
        }
        
        this.showLoading();
        
        try {
            // Animacja kroków
            this.animateProgress();
            
            const response = await fetch('/api/news', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rssUrl })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Błąd pobierania newsów');
            }
            
            const data = await response.json();
            this.showResults(data);
            
        } catch (error) {
            console.error('Błąd:', error);
            this.showError(error.message);
        }
    },
    
    // Walidacja URL
    isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    },
    
    // Pokazanie ekranu ładowania
    showLoading() {
        this.hideAllSections();
        document.getElementById('loading-section').style.display = 'block';
        document.getElementById('fetch-btn').disabled = true;
        this.currentStep = 0;
    },
    
    // Animacja postępu
    animateProgress() {
        const steps = ['step-1', 'step-2', 'step-3'];
        
        const animateStep = (index) => {
            if (index >= steps.length) return;
            
            // Aktywuj obecny krok
            document.getElementById(steps[index]).classList.add('active');
            
            // Kontynuuj po delay
            setTimeout(() => {
                animateStep(index + 1);
            }, 1500);
        };
        
        animateStep(0);
    },
    
    // Pokazanie wyników
    showResults(data) {
        this.hideAllSections();
        
        // Aktualizacja nagłówka
        document.getElementById('feed-title').textContent = data.feedTitle || 'Newsy RSS';
        const feedLink = document.getElementById('feed-link');
        if (data.feedLink) {
            feedLink.href = data.feedLink;
            feedLink.style.display = 'inline';
        } else {
            feedLink.style.display = 'none';
        }
        
        // Generowanie artykułów
        const articlesContainer = document.getElementById('articles-container');
        articlesContainer.innerHTML = '';
        
        if (data.articles && data.articles.length > 0) {
            data.articles.forEach((article, index) => {
                const articleElement = this.createArticleElement(article, index);
                articlesContainer.appendChild(articleElement);
            });
        } else {
            articlesContainer.innerHTML = '<p style="text-align: center; color: #666;">Nie znaleziono artykułów w tym RSS.</p>';
        }
        
        document.getElementById('results-section').style.display = 'block';
        document.getElementById('fetch-btn').disabled = false;
        
        // Scroll do wyników
        document.getElementById('results-section').scrollIntoView({ 
            behavior: 'smooth' 
        });
    },
    
    // Tworzenie elementu artykułu
    createArticleElement(article, index) {
        const articleDiv = document.createElement('div');
        articleDiv.className = 'article-card';
        articleDiv.style.animationDelay = `${index * 0.1}s`;
        
        // Formatowanie daty
        let formattedDate = 'Brak daty';
        if (article.pubDate) {
            try {
                const date = new Date(article.pubDate);
                formattedDate = date.toLocaleDateString('pl-PL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (e) {
                formattedDate = article.pubDate;
            }
        }
        
        articleDiv.innerHTML = `
            <div class="article-title">
                <h3>${this.escapeHtml(article.translatedTitle || article.originalTitle)}</h3>
                ${article.link ? `<a href="${article.link}" target="_blank" rel="noopener noreferrer" class="article-link">
                    <i class="fas fa-external-link-alt"></i> Czytaj
                </a>` : ''}
            </div>
            
            <div class="article-date">
                <i class="fas fa-calendar"></i> ${formattedDate}
            </div>
            
            ${article.summary ? `
            <div class="article-summary">
                <h4><i class="fas fa-robot"></i> Streszczenie AI</h4>
                <p>${this.escapeHtml(article.summary)}</p>
            </div>
            ` : ''}
            
            <div class="article-details">
                ${article.translatedTitle !== article.originalTitle ? `
                <div class="detail-section translation-section">
                    <h4><i class="fas fa-language"></i> Tłumaczenie polskie</h4>
                    <p><strong>Tytuł:</strong> ${this.escapeHtml(article.translatedTitle)}</p>
                    ${article.translatedContent ? `<p><strong>Treść:</strong> ${this.escapeHtml(article.translatedContent)}</p>` : ''}
                </div>
                ` : ''}
                
                <div class="detail-section original-section">
                    <h4><i class="fas fa-globe"></i> Oryginał</h4>
                    <p><strong>Tytuł:</strong> ${this.escapeHtml(article.originalTitle)}</p>
                    ${article.originalContent ? `<p><strong>Treść:</strong> ${this.escapeHtml(article.originalContent)}</p>` : ''}
                </div>
            </div>
        `;
        
        return articleDiv;
    },
    
    // Pokazanie błędu
    showError(message) {
        this.hideAllSections();
        document.getElementById('error-text').textContent = message;
        document.getElementById('error-section').style.display = 'block';
        document.getElementById('fetch-btn').disabled = false;
    },
    
    // Ukrycie wszystkich sekcji
    hideAllSections() {
        document.getElementById('loading-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('error-section').style.display = 'none';
        
        // Reset kroków
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
    },
    
    // Reset aplikacji
    resetApp() {
        this.hideAllSections();
        document.getElementById('rss-url').value = '';
        document.getElementById('rss-url').focus();
        
        // Scroll do góry
        window.scrollTo({ 
            top: 0, 
            behavior: 'smooth' 
        });
    },
    
    // Escape HTML dla bezpieczeństwa
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
};

// Obsługa błędów globalnych
window.addEventListener('error', (e) => {
    console.error('Błąd aplikacji:', e.error);
});

// Obsługa błędów fetch
window.addEventListener('unhandledrejection', (e) => {
    console.error('Nieobsłużony błąd Promise:', e.reason);
    NewsApp.showError('Wystąpił nieoczekiwany błąd aplikacji');
});

// Inicjalizacja po załadowaniu DOM
document.addEventListener('DOMContentLoaded', () => {
    NewsApp.init();
});

// Obsługa powrotu przeglądarki
window.addEventListener('popstate', () => {
    NewsApp.resetApp();
});

// Periodic sprawdzenie połączenia
setInterval(() => {
    NewsApp.checkAPIStatus();
}, 30000); // co 30 sekund