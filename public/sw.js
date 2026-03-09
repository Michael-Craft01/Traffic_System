// Minimal Service Worker for PWA compliance
const CACHE_NAME = 'traffic-brain-v1';

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (event) => {
    // Simple pass-through for now, as we rely on live data
    event.respondWith(fetch(event.request));
});
