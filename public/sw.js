// Service Worker fallback - currently not used
// This file exists to prevent 404 errors if browser tries to load it

console.log('Service Worker loaded (fallback)');

// Empty service worker - no caching or offline functionality
self.addEventListener('fetch', (event) => {
    // Pass through all requests without caching
    return;
});

self.addEventListener('install', (event) => {
    console.log('Service Worker installed');
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activated');
});