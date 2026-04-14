// ==================== Service Worker لمنصة استشاريون الطبية ====================
// الإصدار: 2.0.0
// تاريخ التحديث: 15 أبريل 2025
// بإشراف: د. صلاح الأهدل

const CACHE_NAME = 'estsharion-v2.0.0';
const OFFLINE_URL = '/offline.html';

// الملفات التي سيتم تخزينها مؤقتاً (Cache)
const urlsToCache = [
    '/',
    '/index.html',
    '/offline.html',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
    'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js'
];

// ==================== تثبيت Service Worker ====================
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    
    // تخطي الانتظار لتفعيل الـ SW فوراً
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('[Service Worker] Cache addAll failed:', err);
            })
    );
});

// ==================== تنشيط Service Worker ====================
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    
    // حذف المخابئ القديمة
    event.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(keyList.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    
    // السيطرة على الصفحات المفتوحة فوراً
    self.clients.claim();
});

// ==================== اعتراض الطلبات ====================
self.addEventListener('fetch', event => {
    // تخطي طلبات التحليلات والمقاييس
    if (event.request.url.includes('google-analytics') || 
        event.request.url.includes('firebase')) {
        return;
    }
    
    // استراتيجية: Cache First ثم Network
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // إذا وجد في الكاش، أعده
                if (response) {
                    return response;
                }
                
                // إذا لم يوجد، قم بجلبها من الشبكة
                return fetch(event.request)
                    .then(networkResponse => {
                        // التحقق من صحة الاستجابة
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // تخزين نسخة من الاستجابة في الكاش
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            })
                            .catch(err => console.error('[Service Worker] Cache put failed:', err));
                        
                        return networkResponse;
                    })
                    .catch(() => {
                        // إذا فشلت الشبكة وكان الطلب لصفحة HTML
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match(OFFLINE_URL);
                        }
                        
                        // إرجاع استجابة عامة للخطأ
                        return new Response('⚠️ غير متصل بالإنترنت. يرجى التحقق من اتصالك.', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/html; charset=UTF-8',
                                'Content-Language': 'ar'
                            })
                        });
                    });
            })
    );
});

// ==================== معالجة الإشعارات (Push Notifications) ====================
self.addEventListener('push', event => {
    console.log('[Service Worker] Push Received:', event);
    
    let data = {
        title: 'استشاريون',
        body: 'لديك تحديث جديد على المنصة الطبية',
        icon: '/icon-192.png',
        badge: '/badge.png',
        tag: 'estsharion-notification',
        vibrate: [200, 100, 200],
        data: {
            url: '/'
        },
        actions: [
            {
                action: 'open',
                title: 'فتح التطبيق',
                icon: '/icon-72.png'
            },
            {
                action: 'dismiss',
                title: 'تجاهل',
                icon: '/icon-72.png'
            }
        ]
    };
    
    // محاولة استخراج البيانات من الإشعار
    if (event.data) {
        try {
            const parsedData = event.data.json();
            data = { ...data, ...parsedData };
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        tag: data.tag,
        vibrate: data.vibrate,
        data: data.data,
        actions: data.actions,
        requireInteraction: true,
        silent: false,
        lang: 'ar',
        dir: 'rtl'
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ==================== معالجة النقر على الإشعار ====================
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click:', event);
    
    event.notification.close();
    
    // معالجة إجراءات الإشعار
    if (event.action === 'dismiss') {
        return;
    }
    
    // فتح التطبيق عند النقر على الإشعار
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(windowClients => {
            // البحث عن نافذة مفتوحة بالفعل
            for (let client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // إذا لم توجد نافذة مفتوحة، افتح واحدة جديدة
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// ==================== معالجة الإشعارات المغلقة ====================
self.addEventListener('notificationclose', event => {
    console.log('[Service Worker] Notification closed:', event);
    // يمكن إضافة تحليلات هنا لتتبع التفاعل مع الإشعارات
});

// ==================== مزامنة الخلفية (Background Sync) ====================
self.addEventListener('sync', event => {
    console.log('[Service Worker] Background sync:', event);
    
    if (event.tag === 'sync-appointments') {
        event.waitUntil(syncAppointments());
    } else if (event.tag === 'sync-prescriptions') {
        event.waitUntil(syncPrescriptions());
    }
});

// مزامنة المواعيد غير المرسلة
async function syncAppointments() {
    try {
        const cache = await caches.open('pending-appointments');
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await fetch(request);
            if (response.ok) {
                await cache.delete(request);
                console.log('[Service Worker] Synced appointment successfully');
            }
        }
    } catch (err) {
        console.error('[Service Worker] Sync appointments failed:', err);
    }
}

// مزامنة الوصفات غير المرسلة
async function syncPrescriptions() {
    try {
        const cache = await caches.open('pending-prescriptions');
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await fetch(request);
            if (response.ok) {
                await cache.delete(request);
                console.log('[Service Worker] Synced prescription successfully');
            }
        }
    } catch (err) {
        console.error('[Service Worker] Sync prescriptions failed:', err);
    }
}

// ==================== تحديث الملفات في الخلفية ====================
self.addEventListener('message', event => {
    console.log('[Service Worker] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.delete(CACHE_NAME).then(() => {
                console.log('[Service Worker] Cache cleared');
                event.ports[0].postMessage({ status: 'success', message: 'Cache cleared' });
            })
        );
    }
    
    if (event.data && event.data.type === 'GET_CACHE_SIZE') {
        event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
                cache.keys().then(keys => {
                    event.ports[0].postMessage({ 
                        status: 'success', 
                        size: keys.length,
                        cacheName: CACHE_NAME
                    });
                });
            })
        );
    }
});

// ==================== فحص التحديثات ====================
self.addEventListener('periodicsync', event => {
    console.log('[Service Worker] Periodic sync:', event);
    
    if (event.tag === 'check-updates') {
        event.waitUntil(checkForUpdates());
    }
});

async function checkForUpdates() {
    try {
        const response = await fetch('/version.json', { cache: 'no-cache' });
        const data = await response.json();
        const currentVersion = CACHE_NAME.split('-')[1];
        
        if (data.version !== currentVersion) {
            // إشعار المستخدم بوجود تحديث
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'UPDATE_AVAILABLE',
                    version: data.version
                });
            });
        }
    } catch (err) {
        console.error('[Service Worker] Update check failed:', err);
    }
}

// ==================== استراتيجيات التخزين المتقدمة ====================

// تخزين المقالات للقراءة دون اتصال
async function cacheArticles(articles) {
    const cache = await caches.open('estsharion-articles');
    for (const article of articles) {
        const request = new Request(`/api/articles/${article.id}`);
        const response = new Response(JSON.stringify(article), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put(request, response);
    }
    console.log('[Service Worker] Articles cached:', articles.length);
}

// استرجاع المقالات من الكاش
async function getCachedArticles() {
    const cache = await caches.open('estsharion-articles');
    const requests = await cache.keys();
    const articles = [];
    
    for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
            const article = await response.json();
            articles.push(article);
        }
    }
    return articles;
}

// ==================== التعامل مع الأخطاء ====================
self.addEventListener('error', event => {
    console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
    console.error('[Service Worker] Unhandled rejection:', event.reason);
});

// ==================== تسجيل معلومات الـ SW ====================
console.log('[Service Worker] Initialized successfully');
console.log('[Service Worker] Cache name:', CACHE_NAME);
console.log('[Service Worker] Cached URLs:', urlsToCache.length);
