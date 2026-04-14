// sw.js - Service Worker محسن لدليل الإسعافات الأولية
const CACHE_NAME = 'first-aid-v1';
const STATIC_CACHE_NAME = 'first-aid-static-v1';
const DYNAMIC_CACHE_NAME = 'first-aid-dynamic-v1';

// الملفات الأساسية التي سيتم تخزينها مؤقتاً عند التثبيت
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@600;900&family=Tajawal:wght@400;700&family=Amiri:wght@700&display=swap'
];

// الصور الأساسية (التي يجب أن تكون موجودة)
const imageUrls = [
    '/images/cpr.jpg',
    '/images/stroke_mi.jpg',
    '/images/anaphylaxis.jpg',
    '/images/heatstroke.jpg',
    '/images/drowning.jpg',
    '/images/pph.jpg',
    '/images/bleeding.jpg',
    '/images/fracture.jpg',
    '/images/burn.jpg',
    '/images/choking.jpg',
    '/images/fainting.jpg',
    '/images/snakebite.jpg',
    '/images/poison.jpg',
    '/images/diabetes.jpg',
    '/images/seizure.jpg',
    '/images/nosebleed.jpg',
    '/images/evacuation.jpg',
    '/images/firstaidbag.jpg',
    '/images/conclusion.jpg'
];

// الفيديوهات
const videoUrls = [
    '/videos/cpr.mp4',
    '/videos/stroke_mi.mp4',
    '/videos/anaphylaxis.mp4',
    '/videos/heatstroke.mp4',
    '/videos/drowning.mp4',
    '/videos/pph.mp4',
    '/videos/bleeding.mp4',
    '/videos/fracture.mp4',
    '/videos/burn.mp4',
    '/videos/choking.mp4',
    '/videos/fainting.mp4',
    '/videos/snakebite.mp4',
    '/videos/poison.mp4',
    '/videos/diabetes.mp4',
    '/videos/seizure.mp4',
    '/videos/nosebleed.mp4',
    '/videos/evacuation.mp4'
];

// دمج جميع المسارات
const allUrls = [...urlsToCache, ...imageUrls, ...videoUrls];

// تثبيت Service Worker
self.addEventListener('install', function(event) {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then(function(cache) {
            console.log('[Service Worker] Caching static assets');
            // إضافة الملفات واحداً تلو الآخر لتجنب فشل كل شيء إذا فشل ملف واحد
            return Promise.allSettled(
                allUrls.map(url => {
                    return cache.add(url).catch(err => {
                        console.warn(`[Service Worker] Failed to cache: ${url}`, err);
                    });
                })
            );
        }).then(() => {
            console.log('[Service Worker] Installation complete');
            return self.skipWaiting();
        })
    );
});

// استراتيجية التخزين المؤقت: "Cache First with Network Fallback"
self.addEventListener('fetch', function(event) {
    const requestUrl = new URL(event.request.url);
    
    // تجاهل طلبات التحليلات والإعلانات
    if (requestUrl.hostname.includes('googletagmanager') || 
        requestUrl.hostname.includes('google-analytics')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // تجاهل طلبات TensorFlow (كبيرة الحجم)
    if (requestUrl.hostname.includes('cdn.jsdelivr.net') && 
        (requestUrl.pathname.includes('tensorflow') || requestUrl.pathname.includes('mobilenet'))) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    event.respondWith(
        caches.match(event.request).then(function(cachedResponse) {
            // إذا كان الملف موجوداً في التخزين المؤقت
            if (cachedResponse) {
                console.log(`[Service Worker] Serving from cache: ${event.request.url}`);
                return cachedResponse;
            }
            
            // إذا لم يكن موجوداً، جلب من الشبكة
            console.log(`[Service Worker] Fetching from network: ${event.request.url}`);
            return fetch(event.request).then(function(networkResponse) {
                // تخزين الملفات الديناميكية (مثل الصور الجديدة)
                if (event.request.url.includes('/images/') || 
                    event.request.url.includes('/videos/')) {
                    return caches.open(DYNAMIC_CACHE_NAME).then(function(cache) {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }
                return networkResponse;
            }).catch(function() {
                // صورة افتراضية عند عدم وجود الصورة
                if (event.request.url.includes('.jpg') || event.request.url.includes('.png')) {
                    return caches.match('/images/placeholder.jpg');
                }
                // صفحة خطأ مخصصة
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline.html');
                }
                return new Response('⚠️ غير متوفر حالياً', {
                    status: 404,
                    statusText: 'Not Found',
                    headers: new Headers({ 'Content-Type': 'text/html' })
                });
            });
        })
    );
});

// تحديث التخزين المؤقت عند تفعيل إصدار جديد
self.addEventListener('activate', function(event) {
    console.log('[Service Worker] Activating...');
    const cacheWhitelist = [STATIC_CACHE_NAME, DYNAMIC_CACHE_NAME];
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Activation complete');
            return self.clients.claim();
        })
    );
});

// التعامل مع الإشعارات (للإصدارات المستقبلية)
self.addEventListener('push', function(event) {
    const options = {
        body: event.data.text(),
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-icon.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            { action: 'open', title: 'فتح التطبيق' },
            { action: 'close', title: 'إغلاق' }
        ]
    };
    event.waitUntil(
        self.registration.showNotification('🚑 دليل الإسعافات الأولية', options)
    );
});