// Główny obiekt aplikacji
const NewsApp = {
    currentStep: 0,
    initialized: false,
    apiBaseUrl: 'http://localhost:3000', // Backend server URL
    
    // Inicjalizacja aplikacji
    init() {
        // Prevent double initialization
        if (this.initialized) {
            console.log('NewsApp already initialized');
            return;
        }
        
        // Wait for authentication before initializing
        if (!window.authManager || !window.authManager.currentUser) {
            console.log('Waiting for authentication...');
            return;
        }
        
        console.log('Initializing NewsApp...');
        this.bindEvents();
        this.checkAPIStatus();
        this.loadUserFeeds();
        this.initialized = true;
    },
    
    // Re-bind events after dashboard becomes visible
    rebindDashboardEvents() {
        console.log('🔄 Rebinding dashboard events...');
        
        // Re-bind add feed button
        const addFeedBtn = document.getElementById('add-feed-btn');
        if (addFeedBtn) {
            // Remove existing listeners first
            const newBtn = addFeedBtn.cloneNode(true);
            addFeedBtn.parentNode.replaceChild(newBtn, addFeedBtn);
            
            // Add new listener
            newBtn.addEventListener('click', (e) => {
                console.log('🔵 Add feed button clicked! (rebound)');
                e.preventDefault();
                e.stopPropagation();
                this.showAddFeedModal();
            });
            console.log('✓ Add feed button rebound', newBtn);
        } else {
            console.warn('❌ Add feed button still not found after rebinding!');
        }
        
        // Re-bind add feed form
        const addFeedForm = document.getElementById('add-feed-form');
        if (addFeedForm) {
            // Remove existing listeners by cloning
            const newForm = addFeedForm.cloneNode(true);
            addFeedForm.parentNode.replaceChild(newForm, addFeedForm);
            
            // Add new listener
            newForm.addEventListener('submit', (e) => {
                console.log('🔵 Add feed form submitted! (rebound)');
                e.preventDefault();
                this.addUserFeed();
            });
            console.log('✓ Add feed form rebound', newForm);
        } else {
            console.warn('❌ Add feed form not found after rebinding!');
        }
    },
    
    // Przypisanie event listenerów
    bindEvents() {
        console.log('Binding event listeners...');
        
        // Process article button
        const processArticleBtn = document.getElementById('process-article-btn');
        if (processArticleBtn) {
            processArticleBtn.addEventListener('click', () => this.showProcessArticleModal());
            console.log('✓ Process article button event bound');
        }
        
        // Refresh news button
        const refreshNewsBtn = document.getElementById('refresh-news');
        if (refreshNewsBtn) {
            refreshNewsBtn.addEventListener('click', () => this.refreshAllFeeds());
            console.log('✓ Refresh news button event bound');
        }
        
        // Process article form
        const processForm = document.getElementById('process-article-form');
        if (processForm) {
            processForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.processArticle();
            });
            console.log('✓ Process article form event bound');
        }
        
        // Add feed form
        const addFeedForm = document.getElementById('add-feed-form');
        if (addFeedForm) {
            addFeedForm.addEventListener('submit', (e) => {
                console.log('🔵 Add feed form submitted!', e);
                e.preventDefault();
                this.addUserFeed();
            });
            console.log('✓ Add feed form event bound', addFeedForm);
        } else {
            console.warn('❌ Add feed form not found!');
        }
        
        // Add feed modal controls
        const addFeedBtn = document.getElementById('add-feed-btn');
        if (addFeedBtn) {
            addFeedBtn.addEventListener('click', (e) => {
                console.log('🔵 Add feed button clicked!', e);
                e.preventDefault();
                e.stopPropagation();
                this.showAddFeedModal();
            });
            console.log('✓ Add feed button event bound', addFeedBtn);
        } else {
            console.warn('❌ Add feed button not found! Current DOM state:');
            console.log('Dashboard view exists:', !!document.getElementById('dashboard-view'));
            console.log('Dashboard visible:', document.getElementById('dashboard-view')?.style?.display !== 'none');
        }
        
        // Removed test button
        
        const closeFeedModal = document.getElementById('close-feed-modal');
        if (closeFeedModal) {
            closeFeedModal.addEventListener('click', () => this.hideAddFeedModal());
        }
        
        const closeProcessModal = document.getElementById('close-process-modal');
        if (closeProcessModal) {
            closeProcessModal.addEventListener('click', () => this.hideProcessArticleModal());
        }
        
        // Retry button
        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.refreshAllFeeds());
        }
        
        // Settings form
        const saveSettingsBtn = document.getElementById('save-settings');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveUserSettings());
        }
    },
    
    // Sprawdzenie statusu API
    async checkAPIStatus() {
        try {
            console.log('Sprawdzanie statusu API...');
            
            // Use regular fetch for public status endpoint (no auth required)
            const response = await fetch(this.apiBaseUrl + '/api/status');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const response_data = await response.json();
            console.log('Status API response:', response_data);
            
            // Handle both development and production response formats
            const status = response_data.data || response_data;
            
            // Aktualizacja statusu DeepL
            const deeplStatus = document.getElementById('deepl-status');
            if (deeplStatus) {
                deeplStatus.textContent = status.deepl ? '✓ Połączony' : '✗ Brak klucza';
                deeplStatus.className = `status-indicator ${status.deepl ? 'connected' : 'disconnected'}`;
            }
            
            // Aktualizacja statusu OpenAI
            const openaiStatus = document.getElementById('openai-status');
            if (openaiStatus) {
                openaiStatus.textContent = status.openai ? '✓ Połączony' : '✗ Brak klucza';
                openaiStatus.className = `status-indicator ${status.openai ? 'connected' : 'disconnected'}`;
            }
            
            // Aktualizacja statusu Supabase
            const supabaseStatus = document.getElementById('supabase-status');
            if (supabaseStatus) {
                const isSupabaseConfigured = status.supabase;
                const isSupabaseConnected = isSupabaseConfigured && window.authManager && window.authManager.isInitialized;
                
                if (isSupabaseConnected) {
                    supabaseStatus.textContent = '✓ Połączony';
                    supabaseStatus.className = 'status-indicator connected';
                } else if (isSupabaseConfigured) {
                    supabaseStatus.textContent = '⚠ Konfiguracja OK, sprawdzam połączenie...';
                    supabaseStatus.className = 'status-indicator warning';
                } else {
                    supabaseStatus.textContent = '✗ Brak konfiguracji';
                    supabaseStatus.className = 'status-indicator disconnected';
                }
            }
            
        } catch (error) {
            console.error('Błąd sprawdzania statusu API:', error);
            const deeplStatus = document.getElementById('deepl-status');
            const openaiStatus = document.getElementById('openai-status');
            const supabaseStatus = document.getElementById('supabase-status');
            
            if (deeplStatus) deeplStatus.textContent = 'Błąd';
            if (openaiStatus) openaiStatus.textContent = 'Błąd';
            if (supabaseStatus) supabaseStatus.textContent = 'Błąd';
        }
    },
    
    // Load user's RSS feeds and display articles
    async loadUserFeeds() {
        try {
            if (!window.authManager || !window.authManager.makeAuthenticatedRequest) {
                console.warn('AuthManager nie jest dostępny, pomijam ładowanie feedów');
                return;
            }
            
            this.showLoading();
            this.animateProgress();
            
            const response = await window.authManager.makeAuthenticatedRequest(this.apiBaseUrl + '/api/news');
            
            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error?.message || errorData.error || 'Błąd pobierania newsów';
                throw new Error(errorMessage);
            }
            
            const response_data = await response.json();
            const data = response_data.data || response_data;
            this.showResults(data);
            
        } catch (error) {
            console.error('Błąd ładowania feedów:', error);
            this.showError(error.message);
        }
    },
    
    // Process single article
    async processArticle() {
        const articleUrl = document.getElementById('article-url').value.trim();
        const shouldTranslate = document.getElementById('process-translate').checked;
        const shouldSummarize = document.getElementById('process-summarize').checked;
        
        if (!articleUrl) {
            this.showError('Proszę wprowadzić URL artykułu');
            return;
        }
        
        if (!this.isValidURL(articleUrl)) {
            this.showError('Proszę wprowadzić poprawny URL');
            return;
        }
        
        this.hideProcessArticleModal();
        this.showLoading();
        
        try {
            if (!window.authManager || !window.authManager.makeAuthenticatedRequest) {
                console.warn('AuthManager nie jest dostępny, nie można przetworzyć artykułu');
                this.showError('System uwierzytelniania nie jest dostępny');
                return;
            }
            
            this.animateProgress();
            
            const response = await window.authManager.makeAuthenticatedRequest(this.apiBaseUrl + '/api/news/process', {
                method: 'POST',
                body: JSON.stringify({
                    articleUrl,
                    translate: shouldTranslate,
                    summarize: shouldSummarize
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error?.message || errorData.error || 'Błąd przetwarzania artykułu';
                throw new Error(errorMessage);
            }
            
            const response_data = await response.json();
            const data = response_data.data || response_data;
            
            // Show single article result
            this.showResults({ articles: [data] });
            
        } catch (error) {
            console.error('Błąd przetwarzania artykułu:', error);
            this.showError(error.message);
        }
    },
    
    // Refresh all user feeds
    async refreshAllFeeds() {
        this.loadUserFeeds();
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
        const loadingSection = document.getElementById('loading-section');
        if (loadingSection) {
            loadingSection.style.display = 'block';
        }
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
        
        const resultsSection = document.getElementById('results-section');
        const newsResults = document.getElementById('news-results');
        const articlesCount = document.getElementById('articles-count');
        
        if (!resultsSection || !newsResults) return;
        
        // Update articles count
        if (articlesCount) {
            const count = data.articles ? data.articles.length : 0;
            articlesCount.textContent = `${count} artykułów`;
        }
        
        // Clear previous results
        newsResults.innerHTML = '';
        
        if (data.articles && data.articles.length > 0) {
            data.articles.forEach((article, index) => {
                const articleElement = this.createArticleElement(article, index);
                newsResults.appendChild(articleElement);
            });
        } else {
            newsResults.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><p>Brak artykułów do wyświetlenia.</p><p>Dodaj RSS feedy w sekcji Dashboard.</p></div>';
        }
        
        resultsSection.style.display = 'block';
        
        // Scroll to results
        resultsSection.scrollIntoView({ 
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
        if (article.pubDate || article.pub_date) {
            try {
                const date = new Date(article.pubDate || article.pub_date);
                formattedDate = date.toLocaleDateString('pl-PL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (e) {
                formattedDate = article.pubDate || article.pub_date;
            }
        }
        
        const title = article.translated_title || article.translatedTitle || article.original_title || article.originalTitle || article.title || 'Bez tytułu';
        const originalTitle = article.original_title || article.originalTitle || article.title || title;
        const link = article.link || article.url || article.article_url;
        const summary = article.summary;
        const translatedContent = article.translated_content || article.translatedContent || article.description;
        const originalContent = article.original_content || article.originalContent || article.description;
        
        articleDiv.innerHTML = `
            <div class="article-header">
                <h3>${this.escapeHtml(title)}</h3>
                <div class="article-actions">
                    ${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer" class="article-link">
                        <i class="fas fa-external-link-alt"></i> Czytaj
                    </a>` : ''}
                    <button class="save-article-btn" onclick="NewsApp.saveArticle('${article.id || index}')">
                        <i class="fas fa-bookmark"></i>
                    </button>
                </div>
            </div>
            
            <div class="article-meta">
                <span class="article-date">
                    <i class="fas fa-calendar"></i> ${formattedDate}
                </span>
                ${article.feed_name ? `<span class="article-source">
                    <i class="fas fa-rss"></i> ${this.escapeHtml(article.feed_name)}
                </span>` : ''}
            </div>
            
            ${summary ? `
            <div class="article-summary">
                <h4><i class="fas fa-robot"></i> Streszczenie AI</h4>
                <div class="summary-content">${this.escapeHtml(summary)}</div>
            </div>
            ` : ''}
            
            <div class="article-details">
                ${title !== originalTitle ? `
                <div class="detail-section translation-section">
                    <h4><i class="fas fa-language"></i> Tłumaczenie</h4>
                    <p><strong>Tytuł:</strong> ${this.escapeHtml(title)}</p>
                    ${translatedContent ? `<div class="content-preview">${this.escapeHtml(translatedContent.substring(0, 200))}...</div>` : ''}
                </div>
                ` : ''}
                
                <div class="detail-section original-section">
                    <h4><i class="fas fa-globe"></i> Oryginał</h4>
                    <p><strong>Tytuł:</strong> ${this.escapeHtml(originalTitle)}</p>
                    ${originalContent ? `<div class="content-preview">${this.escapeHtml(originalContent.substring(0, 200))}...</div>` : ''}
                </div>
            </div>
        `;
        
        return articleDiv;
    },
    
    // Pokazanie błędu
    showError(message) {
        this.hideAllSections();
        const errorSection = document.getElementById('error-section');
        const errorDetails = document.getElementById('error-details');
        
        if (errorSection && errorDetails) {
            errorDetails.textContent = message;
            errorSection.style.display = 'block';
        }
    },
    
    // Ukrycie wszystkich sekcji
    hideAllSections() {
        const loadingSection = document.getElementById('loading-section');
        const resultsSection = document.getElementById('results-section');
        const errorSection = document.getElementById('error-section');
        
        if (loadingSection) loadingSection.style.display = 'none';
        if (resultsSection) resultsSection.style.display = 'none';
        if (errorSection) errorSection.style.display = 'none';
        
        // Reset kroków
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
    },
    
    // Modal management
    showAddFeedModal() {
        console.log('🔵 ShowAddFeedModal called');
        const modal = document.getElementById('add-feed-modal');
        console.log('Modal element:', modal);
        console.log('Modal current display:', modal?.style?.display);
        console.log('Modal current classes:', modal?.className);
        
        if (modal) {
            console.log('✓ Modal found, showing...');
            modal.style.display = 'block';
            setTimeout(() => {
                modal.classList.add('show');
                console.log('✓ Modal show class added');
            }, 10);
        } else {
            console.error('❌ Add feed modal not found!');
            console.log('Available modals in DOM:', document.querySelectorAll('[id*="modal"]'));
        }
    },
    
    hideAddFeedModal() {
        const modal = document.getElementById('add-feed-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    },
    
    showProcessArticleModal() {
        const modal = document.getElementById('process-article-modal');
        if (modal) {
            modal.style.display = 'block';
            setTimeout(() => modal.classList.add('show'), 10);
        }
    },
    
    hideProcessArticleModal() {
        const modal = document.getElementById('process-article-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    },
    
    // Add user RSS feed
    async addUserFeed() {
        console.log('🔵 addUserFeed called');
        
        const feedUrlElement = document.getElementById('feed-url');
        const feedNameElement = document.getElementById('feed-name');
        
        console.log('Feed URL element:', feedUrlElement);
        console.log('Feed name element:', feedNameElement);
        
        const feedUrl = feedUrlElement?.value?.trim() || '';
        const feedName = feedNameElement?.value?.trim() || '';
        
        console.log('Feed URL:', feedUrl);
        console.log('Feed name:', feedName);
        
        if (!feedUrl) {
            console.warn('No feed URL provided');
            this.showError('URL RSS jest wymagany');
            return;
        }
        
        try {
            console.log('🔍 Checking authManager...');
            console.log('window.authManager:', window.authManager);
            console.log('typeof window.authManager:', typeof window.authManager);
            
            // Enhanced authManager recovery
            let authMgr = window.authManager;
            
            // First fallback: check for global authManager variable
            if (!authMgr && typeof authManager !== 'undefined') {
                console.log('Found global authManager variable, assigning to window...');
                window.authManager = authManager;
                authMgr = authManager;
            }
            
            // Second fallback: force re-initialization
            if (!authMgr && typeof AuthManager !== 'undefined') {
                console.log('Force creating new AuthManager instance...');
                try {
                    authMgr = new AuthManager();
                    window.authManager = authMgr;
                    // Give it time to initialize
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (initError) {
                    console.error('Failed to create new AuthManager:', initError);
                }
            }
            
            if (!authMgr) {
                console.error('❌ AuthManager nie jest dostępny w żadnej formie');
                this.showError('AuthManager nie jest dostępny, nie można dodać RSS feed. Sprawdź czy jesteś zalogowany.');
                return;
            }
            
            console.log('✓ Using authManager:', authMgr);
            console.log('authMgr.makeAuthenticatedRequest:', typeof authMgr?.makeAuthenticatedRequest);
            console.log('authMgr.currentUser:', authMgr?.currentUser);
            console.log('authMgr.isInitialized:', authMgr?.isInitialized);
            
            if (!authMgr.makeAuthenticatedRequest) {
                console.error('❌ makeAuthenticatedRequest method not available');
                this.showError('Metoda uwierzytelniania nie jest dostępna');
                return;
            }
            
            // Check and refresh user session
            if (!authMgr.currentUser) {
                console.log('⚠️ No current user, attempting session refresh...');
                
                if (!authMgr.supabase) {
                    console.error('❌ Supabase client not available');
                    this.showError('Klient uwierzytelniania nie jest dostępny');
                    return;
                }
                
                try {
                    const { data: { session }, error } = await authMgr.supabase.auth.getSession();
                    
                    if (error) {
                        console.error('Session refresh error:', error);
                        this.showError('Błąd odświeżania sesji: ' + error.message);
                        return;
                    }
                    
                    if (session?.user) {
                        console.log('✓ Session refreshed, user found:', session.user.email);
                        authMgr.currentUser = session.user;
                        window.authManager = authMgr;
                    } else {
                        console.error('❌ No valid session found');
                        this.showError('Sesja wygasła. Zaloguj się ponownie.');
                        return;
                    }
                } catch (sessionError) {
                    console.error('❌ Session refresh failed:', sessionError);
                    this.showError('Błąd uwierzytelniania: ' + sessionError.message);
                    return;
                }
            } else {
                console.log('✓ Current user available:', authMgr.currentUser.email);
            }
            
            const response = await authMgr.makeAuthenticatedRequest(this.apiBaseUrl + '/api/user/feeds', {
                method: 'POST',
                body: JSON.stringify({
                    rssUrl: feedUrl,
                    customName: feedName || feedUrl
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Błąd dodawania RSS');
            }
            
            this.hideAddFeedModal();
            document.getElementById('add-feed-form').reset();
            
            // Refresh feeds list if in dashboard
            if (typeof loadDashboardData === 'function') {
                loadDashboardData();
            }
            
        } catch (error) {
            console.error('❌ Błąd dodawania RSS:', error);
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            
            // Provide more specific error messages based on error type
            if (error.message?.includes('authenticate') || error.message?.includes('token') || error.message?.includes('unauthorized')) {
                this.showError('Błąd uwierzytelniania. Spróbuj odświeżyć stronę i zalogować się ponownie.');
            } else if (error.message?.includes('network') || error.message?.includes('fetch') || error.name === 'TypeError') {
                this.showError('Błąd połączenia z serwerem. Sprawdź czy serwer działa.');
            } else if (error.message?.includes('CORS')) {
                this.showError('Błąd CORS. Sprawdź konfigurację serwera.');
            } else if (error.message?.includes('timeout')) {
                this.showError('Przekroczono limit czasu. Spróbuj ponownie.');
            } else {
                // More detailed error reporting
                const errorMsg = error.message || error.toString() || 'Nieznany błąd';
                this.showError('Błąd dodawania RSS: ' + errorMsg);
            }
        }
    },
    
    // Save user article
    async saveArticle(articleId) {
        try {
            if (!window.authManager || !window.authManager.makeAuthenticatedRequest) {
                console.warn('AuthManager nie jest dostępny, nie można zapisać artykułu');
                return;
            }
            
            const response = await window.authManager.makeAuthenticatedRequest(this.apiBaseUrl + '/api/user/history/read', {
                method: 'POST',
                body: JSON.stringify({ articleUrl: articleId, liked: false })
            });
            
            if (response.ok) {
                // Show visual feedback
                console.log('Artykuł zapisany');
            }
        } catch (error) {
            console.error('Błąd zapisywania artykułu:', error);
        }
    },
    
    // Show error message
    showError(message) {
        console.error('App Error:', message);
        
        // Try to show error in UI if possible
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        }
        
        // Fallback: show alert if no error element found
        if (!errorElement) {
            alert('Błąd: ' + message);
        }
    },
    
    // Save user settings
    async saveUserSettings() {
        const settings = {
            default_language: document.getElementById('default-language').value,
            max_articles: parseInt(document.getElementById('max-articles').value),
            auto_translate: document.getElementById('auto-translate').checked,
            auto_summarize: document.getElementById('auto-summarize').checked
        };
        
        try {
            if (!window.authManager || !window.authManager.makeAuthenticatedRequest) {
                console.warn('AuthManager nie jest dostępny, nie można zapisać ustawień');
                this.showError('System uwierzytelniania nie jest dostępny');
                return;
            }
            
            const response = await window.authManager.makeAuthenticatedRequest(this.apiBaseUrl + '/api/user/settings', {
                method: 'PUT',
                body: JSON.stringify(settings)
            });
            
            if (response.ok) {
                console.log('Ustawienia zapisane');
            }
        } catch (error) {
            console.error('Błąd zapisywania ustawień:', error);
        }
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

// Inicjalizacja po załadowaniu DOM - removed, handled by auth-script.js
// document.addEventListener('DOMContentLoaded', () => {
//     NewsApp.init();
// });

// Obsługa powrotu przeglądarki
window.addEventListener('popstate', () => {
    console.log('Browser back/forward navigation detected');
    // Removed resetApp() as it doesn't exist
    // Could add navigation handling here if needed
});

// Periodic sprawdzenie połączenia
setInterval(() => {
    if (window.authManager && window.authManager.currentUser) {
        NewsApp.checkAPIStatus();
    }
}, 30000); // co 30 sekund

// Expose NewsApp globally for debugging
window.NewsApp = NewsApp;

// Test function for modal
window.testModal = function() {
    console.log('🧪 Testing modal...');
    const modal = document.getElementById('add-feed-modal');
    console.log('Modal found:', !!modal);
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('show');
        console.log('✓ Modal should be visible now');
    }
};

// Test function for button click
window.testButton = function() {
    console.log('🧪 Testing button...');
    const btn = document.getElementById('add-feed-btn');
    console.log('Button found:', !!btn);
    console.log('Button visible:', btn?.offsetHeight > 0);
    console.log('Button parent visible:', btn?.parentElement?.offsetHeight > 0);
    if (btn) {
        btn.click();
        console.log('✓ Button clicked programmatically');
    }
};

// Test function for auth manager
window.testAuth = function() {
    console.log('🧪 Testing AuthManager...');
    console.log('window.authManager:', window.authManager);
    console.log('authManager.currentUser:', window.authManager?.currentUser);
    console.log('authManager.isInitialized:', window.authManager?.isInitialized);
    console.log('authManager.makeAuthenticatedRequest:', typeof window.authManager?.makeAuthenticatedRequest);
    
    if (window.authManager?.getAuthToken) {
        window.authManager.getAuthToken().then(token => {
            console.log('Token available:', !!token);
            console.log('Token length:', token?.length);
        }).catch(err => {
            console.error('Token error:', err);
        });
    }
};