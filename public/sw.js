/* PWA: apenas recursos estaticos, sem armazenamento de dados pessoais. */
const CACHE_NAME = 'clube-static-nov13-2026';
const PRECACHE = ['/images/icon-192.png','/images/icon-512.png','/images/favicon.svg'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => (k.startsWith('clube-segredo-') || k.startsWith('clube-static-')) && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
 const req=event.request;
 if(req.method!=='GET') return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin) return;
 // Nao cachear navegacoes, dados do usuario, config Supabase, APIs ou area admin.
 if(req.mode==='navigate'||url.pathname.startsWith('/api/')||url.pathname.startsWith('/.netlify/')||url.pathname.startsWith('/admin')||url.pathname==='/js/config.js') return;
 if(!(/^\/(images|css|js)\//.test(url.pathname))) return;
 event.respondWith(fetch(req).then(resp=>{if(resp.ok&&resp.type==='basic'){const clone=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(req,clone));}return resp;}).catch(()=>caches.match(req)));
});
