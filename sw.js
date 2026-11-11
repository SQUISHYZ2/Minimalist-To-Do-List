// Offline support: pre-cache the app shell, then serve network-first
// (so edits show up as soon as you're online) with the cache as the safety net.

const CACHE_NAME = 'todo-app-v8';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/apple-icon-180.png',
    './icons/badge-96.png',
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

// ---- Reminders: what is done to a reminder's notification ----
//
// The list lives in the page's localStorage, which a service worker cannot reach. So whatever is pressed on a
// notification is shelved in IndexedDB for the app to carry out (same database and key as app.js: 'todo-app' /
// 'kv' / 'answers'), and every open window is told. The shelf comes first: a window in the background may be
// frozen, and thrown away before it ever hears — then the answer is still there for the next launch.

const appWindows = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((windows) => windows.filter((client) => client.url.startsWith(self.registration.scope)));

function shelve(answer) {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open('todo-app', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('kv');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction('kv', 'readwrite');
            const store = tx.objectStore('kv');
            const got = store.get('answers');
            got.onsuccess = () => store.put((Array.isArray(got.result) ? got.result : []).concat(answer), 'answers');
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
        };
    }).catch(() => { /* nowhere to keep it: the reminder simply stays as it was */ });
}

const openApp = () => self.clients.openWindow(self.registration.scope).catch(() => {});

// "Mark as done" · "Snooze" · or the notification itself, which brings the app to the front with the alarm on show.
self.addEventListener('notificationclick', (event) => {
    const data = event.notification.data || {};
    const how = event.action === 'done' || event.action === 'snooze' ? event.action : 'open';
    const answer = { type: 'answer', id: data.id, at: data.at, how, when: Date.now() };
    event.notification.close();
    event.waitUntil(appWindows().then((apps) => {
        if (how === 'open') {
            const app = apps.find((client) => 'focus' in client);
            if (!app) return shelve(answer).then(openApp);
            app.postMessage(answer);
            return app.focus().catch(() => {});
        }
        return shelve(answer).then(() => {
            apps.forEach((app) => app.postMessage(answer));
            // with nobody there, a snooze needs the app opened to ring again: only a page can keep the time
            return how === 'snooze' && !apps.length ? openApp() : undefined;
        });
    }));
});

// Swiped away: that is a dismissal, and the alarm in the app stops with it.
self.addEventListener('notificationclose', (event) => {
    const data = event.notification.data || {};
    if (!data.id) return;
    const answer = { type: 'answer', id: data.id, at: data.at, how: 'dismiss', when: Date.now() };
    event.waitUntil(appWindows().then((apps) => shelve(answer).then(() => apps.forEach((app) => app.postMessage(answer)))));
});
