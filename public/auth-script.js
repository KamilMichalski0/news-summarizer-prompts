// Modern Authentication JavaScript with smooth animations

class AuthManager {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.isInitialized = false;
        this.apiBaseUrl = 'http://localhost:3000'; // Backend server URL
        
        // Initialize Supabase
        this.initSupabase();
        
        // Bind methods to maintain context
        this.showAuthModal = this.showAuthModal.bind(this);
        this.hideModal = this.hideModal.bind(this);
        this.switchTab = this.switchTab.bind(this);
        this.handleAuth = this.handleAuth.bind(this);
    }
    
    async initSupabase() {
        try {
            console.log('Starting Supabase initialization...');
            
            // Wait for Supabase to be loaded
            if (typeof supabase === 'undefined') {
                console.log('Supabase not loaded, waiting...');
                await this.waitForSupabase();
            }
            
            console.log('Supabase loaded, getting configuration...');
            console.log('window.SUPABASE_URL:', window.SUPABASE_URL);
            console.log('window.SUPABASE_ANON_KEY:', window.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
            
            // Initialize with environment variables (these should be set via server)
            const SUPABASE_URL = window.SUPABASE_URL;
            const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
            
            if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
                throw new Error('Supabase configuration not found - URL or Key missing');
            }
            
            // Validate URL format
            try {
                new URL(SUPABASE_URL);
            } catch (e) {
                throw new Error(`Invalid Supabase URL format: ${SUPABASE_URL}`);
            }
            
            console.log('Creating Supabase client...');
            this.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            this.isInitialized = true;
            console.log('Supabase client created successfully');
            
            // Check for existing session
            await this.checkExistingSession();
            
            // Set up auth state change listener
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state change:', event, session);
                this.handleAuthStateChange(event, session);
            });
            
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            console.log('Showing auth modal due to initialization failure');
            
            // Fallback: Show auth modal after a short delay
            setTimeout(() => {
                this.showAuthModal();
            }, 1000);
        }
    }
    
    waitForSupabase() {
        return new Promise((resolve) => {
            const checkSupabase = () => {
                if (typeof supabase !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkSupabase, 100);
                }
            };
            checkSupabase();
        });
    }
    
    async checkExistingSession() {
        try {
            console.log('Checking existing session...');
            const { data: { session } } = await this.supabase.auth.getSession();
            console.log('Session check result:', session);
            
            if (session) {
                console.log('Found existing session, authenticating user...');
                this.currentUser = session.user;
                await this.handleSuccessfulAuth();
            } else {
                console.log('No existing session, showing auth modal...');
                this.showAuthModal();
            }
        } catch (error) {
            console.error('Session check failed:', error);
            console.log('Session check failed, showing auth modal...');
            this.showAuthModal();
        }
    }
    
    showAuthModal() {
        const modal = document.getElementById('auth-modal');
        const loadingScreen = document.getElementById('loading-screen');
        
        // Hide loading screen
        if (loadingScreen) {
            loadingScreen.classList.add('hide');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
        
        // Show auth modal with animation
        modal.classList.add('show');
        
        // Focus on email input
        setTimeout(() => {
            const emailInput = document.getElementById('auth-email');
            if (emailInput) emailInput.focus();
        }, 300);
    }
    
    hideModal() {
        const modal = document.getElementById('auth-modal');
        modal.classList.remove('show');
    }
    
    async handleSuccessfulAuth() {
        // Hide auth modal
        this.hideModal();
        
        // Hide loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hide');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
        
        // Show main app
        const mainApp = document.getElementById('main-app');
        if (mainApp) {
            mainApp.style.display = 'block';
            // Animate in
            setTimeout(() => {
                mainApp.style.opacity = '1';
                mainApp.style.transform = 'translateY(0)';
            }, 100);
        }
        
        // Update user info
        this.updateUserInfo();
        
        // Initialize main app with a small delay to ensure full auth manager initialization
        if (typeof NewsApp !== 'undefined' && NewsApp.init) {
            setTimeout(() => {
                NewsApp.init();
                
                // Also trigger API status check after successful login
                setTimeout(() => {
                    if (NewsApp.checkAPIStatus) {
                        NewsApp.checkAPIStatus();
                    }
                }, 1000);
            }, 500); // Wait 500ms for auth manager to be fully ready
        }
    }
    
    updateUserInfo() {
        if (!this.currentUser) return;
        
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            const displayName = this.currentUser.user_metadata?.full_name || 
                               this.currentUser.email?.split('@')[0] || 
                               'Użytkownik';
            userNameElement.textContent = displayName;
        }
    }
    
    switchTab(tabType) {
        const loginTab = document.getElementById('login-tab');
        const signupTab = document.getElementById('signup-tab');
        const authTitle = document.getElementById('auth-title');
        const submitButton = document.getElementById('auth-submit');
        
        // Clear any existing messages
        this.clearMessages();
        
        // Reset form
        document.getElementById('auth-form').reset();
        
        if (tabType === 'signup') {
            loginTab.classList.remove('active');
            signupTab.classList.add('active');
            authTitle.textContent = 'Utwórz konto';
            submitButton.innerHTML = '<i class="fas fa-user-plus"></i> Zarejestruj się';
        } else {
            signupTab.classList.remove('active');
            loginTab.classList.add('active');
            authTitle.textContent = 'Zaloguj się';
            submitButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Zaloguj się';
        }
        
        // Add smooth transition effect
        authTitle.style.transform = 'scale(0.95)';
        setTimeout(() => {
            authTitle.style.transform = 'scale(1)';
        }, 150);
    }
    
    async handleAuth(event) {
        event.preventDefault();
        
        // Check if Supabase is initialized
        if (!this.supabase || !this.isInitialized) {
            this.showError('System uwierzytelniania nie jest gotowy. Spróbuj ponownie za chwilę.');
            return;
        }
        
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const isSignup = document.getElementById('signup-tab').classList.contains('active');
        
        // Basic validation
        if (!email || !password) {
            this.showError('Wypełnij wszystkie pola');
            return;
        }
        
        if (password.length < 6) {
            this.showError('Hasło musi mieć co najmniej 6 znaków');
            return;
        }
        
        // Show loading state
        const submitButton = document.getElementById('auth-submit');
        const originalContent = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Przetwarzanie...';
        submitButton.disabled = true;
        
        this.clearMessages();
        
        try {
            console.log(`Attempting ${isSignup ? 'signup' : 'signin'} for:`, email);
            let result;
            
            if (isSignup) {
                result = await this.supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: email.split('@')[0] // Use email prefix as initial name
                        }
                    }
                });
                
                if (result.error) {
                    throw result.error;
                }
                
                if (result.data?.user && !result.data.session) {
                    this.showSuccess('Sprawdź swoją skrzynkę email i kliknij link aktywacyjny');
                    return;
                }
            } else {
                result = await this.supabase.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (result.error) {
                    throw result.error;
                }
            }
            
            if (result.data?.session) {
                this.currentUser = result.data.session.user;
                await this.handleSuccessfulAuth();
            }
            
        } catch (error) {
            console.error('Auth error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            // Reset button state
            submitButton.innerHTML = originalContent;
            submitButton.disabled = false;
        }
    }
    
    getErrorMessage(error) {
        switch (error.message) {
            case 'Invalid login credentials':
                return 'Nieprawidłowe dane logowania';
            case 'User already registered':
                return 'Użytkownik już istnieje. Spróbuj się zalogować.';
            case 'Email not confirmed':
                return 'Email nie został potwierdzony. Sprawdź swoją skrzynkę.';
            case 'Signup requires a valid password':
                return 'Hasło jest wymagane';
            case 'Invalid email':
                return 'Nieprawidłowy adres email';
            default:
                return error.message || 'Wystąpił nieoczekiwany błąd';
        }
    }
    
    async handleLogout() {
        try {
            if (!this.supabase) {
                console.error('Supabase not initialized for logout');
                return;
            }
            
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
            // Reset app state
            this.currentUser = null;
            
            // Hide main app
            const mainApp = document.getElementById('main-app');
            if (mainApp) {
                mainApp.style.display = 'none';
            }
            
            // Show auth modal
            this.showAuthModal();
            
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('Błąd podczas wylogowywania');
        }
    }
    
    handleAuthStateChange(event, session) {
        if (event === 'SIGNED_IN' && session) {
            this.currentUser = session.user;
        } else if (event === 'SIGNED_OUT') {
            this.currentUser = null;
        }
    }
    
    showError(message) {
        const errorDiv = document.getElementById('auth-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.add('show');
            errorDiv.style.display = 'block';
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                errorDiv.classList.remove('show');
            }, 5000);
        }
    }
    
    showSuccess(message) {
        const successDiv = document.getElementById('auth-success');
        if (successDiv) {
            successDiv.textContent = message;
            successDiv.classList.add('show');
            successDiv.style.display = 'block';
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                successDiv.classList.remove('show');
            }, 5000);
        }
    }
    
    clearMessages() {
        const errorDiv = document.getElementById('auth-error');
        const successDiv = document.getElementById('auth-success');
        
        if (errorDiv) {
            errorDiv.classList.remove('show');
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 300);
        }
        
        if (successDiv) {
            successDiv.classList.remove('show');
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 300);
        }
    }
    
    // Get current user's JWT token for API calls
    async getAuthToken() {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        if (!this.currentUser) {
            throw new Error('User not authenticated');
        }
        
        const { data: { session } } = await this.supabase.auth.getSession();
        return session?.access_token;
    }
    
    // Make authenticated API calls
    async makeAuthenticatedRequest(url, options = {}) {
        try {
            const token = await this.getAuthToken();
            
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            };
            
            return await fetch(url, {
                ...options,
                headers
            });
        } catch (error) {
            console.error('Authenticated request failed:', error);
            throw error;
        }
    }
}

// Global variable for authManager - will be initialized after DOM loads
let authManager = null;

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Auth Manager when DOM is ready
    console.log('DOM loaded, initializing AuthManager...');
    console.log('Supabase available:', typeof supabase);
    console.log('Window SUPABASE_URL available:', !!window.SUPABASE_URL);
    console.log('Window SUPABASE_ANON_KEY available:', !!window.SUPABASE_ANON_KEY);
    
    authManager = new AuthManager();
    
    // Make authManager globally available immediately
    window.authManager = authManager;
    console.log('AuthManager made globally available');
    
    // Auth form submission
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', authManager.handleAuth);
    }
    
    // Tab switching
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    
    if (loginTab) {
        loginTab.addEventListener('click', () => authManager.switchTab('login'));
    }
    
    if (signupTab) {
        signupTab.addEventListener('click', () => authManager.switchTab('signup'));
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => authManager.handleLogout());
    }
    
    // Dashboard button
    const dashboardBtn = document.getElementById('dashboard-btn');
    const backToNewsBtn = document.getElementById('back-to-news');
    const dashboardView = document.getElementById('dashboard-view');
    const newsView = document.getElementById('news-view');
    
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            if (dashboardView && newsView) {
                newsView.style.display = 'none';
                dashboardView.style.display = 'block';
                
                // Load dashboard data
                loadDashboardData();
                
                // Rebind dashboard events now that it's visible
                setTimeout(() => {
                    if (typeof NewsApp !== 'undefined' && NewsApp.rebindDashboardEvents) {
                        NewsApp.rebindDashboardEvents();
                    }
                }, 100);
            }
        });
    }
    
    if (backToNewsBtn) {
        backToNewsBtn.addEventListener('click', () => {
            if (dashboardView && newsView) {
                dashboardView.style.display = 'none';
                newsView.style.display = 'block';
            }
        });
    }
    
    // Forgot password
    const forgotPasswordLink = document.getElementById('forgot-password');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('auth-email').value.trim();
            if (!email) {
                authManager.showError('Wprowadź adres email');
                return;
            }
            
            try {
                if (!authManager || !authManager.supabase) {
                    throw new Error('Supabase not initialized');
                }
                
                const { error } = await authManager.supabase.auth.resetPasswordForEmail(email);
                if (error) throw error;
                
                authManager.showSuccess('Link resetujący hasło został wysłany na podany email');
            } catch (error) {
                console.error('Password reset error:', error);
                if (authManager) {
                    authManager.showError('Błąd podczas resetowania hasła');
                }
            }
        });
    }
    
    // Input animations
    const inputs = document.querySelectorAll('.input-group input');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', () => {
            input.parentElement.classList.remove('focused');
        });
    });
});

// Dashboard functionality
async function loadDashboardData() {
    try {
        // Load user feeds
        const feedsResponse = await authManager.makeAuthenticatedRequest(authManager.apiBaseUrl + '/api/user/feeds');
        if (feedsResponse.ok) {
            const feedsData = await feedsResponse.json();
            updateFeedsList(feedsData.data?.feeds || []);
        }
        
        // Load reading history
        const historyResponse = await authManager.makeAuthenticatedRequest(authManager.apiBaseUrl + '/api/user/history?limit=10');
        if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            updateReadingHistory(historyData.data?.history || []);
        }
        
        // Load summaries
        const summariesResponse = await authManager.makeAuthenticatedRequest(authManager.apiBaseUrl + '/api/user/summaries?limit=5');
        if (summariesResponse.ok) {
            const summariesData = await summariesResponse.json();
            updateSummaries(summariesData.data?.summaries || []);
        }
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

function updateFeedsList(feeds) {
    const feedsList = document.getElementById('user-feeds-list');
    if (!feedsList) return;
    
    if (feeds.length === 0) {
        feedsList.innerHTML = '<p class="empty-state">Nie masz jeszcze żadnych RSS feedów</p>';
        return;
    }
    
    feedsList.innerHTML = feeds.map(feed => `
        <div class="feed-item">
            <div class="feed-info">
                <h4>${feed.custom_name}</h4>
                <p>${feed.rss_url}</p>
            </div>
            <button class="btn-remove" data-feed-id="${feed.id}">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    // Add event listeners to remove buttons
    const removeButtons = feedsList.querySelectorAll('.btn-remove');
    removeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const feedId = button.getAttribute('data-feed-id');
            if (feedId) {
                removeFeed(feedId);
            }
        });
    });
}

function updateReadingHistory(history) {
    const historyDiv = document.getElementById('reading-history');
    if (!historyDiv) return;
    
    if (history.length === 0) {
        historyDiv.innerHTML = '<p class="empty-state">Historia jest pusta</p>';
        return;
    }
    
    historyDiv.innerHTML = history.slice(0, 5).map(item => `
        <div class="history-item">
            <div class="history-info">
                <a href="${item.article_url}" target="_blank" rel="noopener">
                    ${new URL(item.article_url).hostname}
                </a>
                <small>${new Date(item.read_at).toLocaleDateString('pl-PL')}</small>
            </div>
            ${item.liked ? '<i class="fas fa-heart liked"></i>' : ''}
        </div>
    `).join('');
}

function updateSummaries(summaries) {
    const summariesDiv = document.getElementById('user-summaries');
    if (!summariesDiv) return;
    
    if (summaries.length === 0) {
        summariesDiv.innerHTML = '<p class="empty-state">Brak zapisanych streszczeń</p>';
        return;
    }
    
    summariesDiv.innerHTML = summaries.map(summary => `
        <div class="summary-item">
            <h4>${summary.article_title || 'Artykuł'}</h4>
            <p class="summary-text">${summary.summary.substring(0, 120)}...</p>
            <small>${new Date(summary.created_at).toLocaleDateString('pl-PL')}</small>
        </div>
    `).join('');
}

// Remove RSS feed function
async function removeFeed(feedId) {
    if (!confirm('Czy na pewno chcesz usunąć ten RSS feed?')) {
        return;
    }
    
    try {
        if (!authManager || !authManager.makeAuthenticatedRequest) {
            console.error('AuthManager nie jest dostępny');
            alert('Błąd uwierzytelniania');
            return;
        }
        
        const response = await authManager.makeAuthenticatedRequest(
            authManager.apiBaseUrl + `/api/user/feeds/${feedId}`,
            { method: 'DELETE' }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Błąd usuwania RSS feed');
        }
        
        console.log('RSS feed usunięty');
        
        // Refresh dashboard data
        if (typeof loadDashboardData === 'function') {
            loadDashboardData();
        }
        
    } catch (error) {
        console.error('Błąd usuwania RSS feed:', error);
        alert('Błąd usuwania RSS feed: ' + error.message);
    }
}

// Initialize authManager only once when DOM is ready
// This code is now handled inside the DOMContentLoaded event listener above

window.loadDashboardData = loadDashboardData;
window.removeFeed = removeFeed;