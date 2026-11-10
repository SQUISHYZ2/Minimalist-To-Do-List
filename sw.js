// Offline support: pre-cache the app shell, then serve network-first
// (so edits show up as soon as you're online) with the cache as the safety net.

const CACHE_NAME = 'todo-app-v6';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/apple-icon-180.png',
    './icons/manifest-icon-192.maskable.png',
    './icons/manifest-icon-512.maskable.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            })
            .catch(() =>
                // An uncached page (e.g. a mistyped deep link) is sent to the app root, where relative assets resolve.
                caches.match(request).then((hit) => hit || (request.mode === 'navigate' ? Response.redirect(self.registration.scope, 302) : Response.error()))
            )
    );
});
