const C='hananel-v3';
const SHELL=['index.html','manifest.json','icon-192.png','icon-512.png','icon-180.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
  if(u.pathname.endsWith('version.json')){e.respondWith(fetch(e.request,{cache:'no-store'}));return}
  const isPage=e.request.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('index.html');
  const key=isPage?'index.html':u.pathname;
  if(u.searchParams.has('fresh')){e.respondWith(fetch(isPage?'index.html':u.pathname,{cache:'no-store'}).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(key,cp))}return r}));return}
  e.respondWith(caches.open(C).then(async c=>{const hit=await c.match(key);
    const net=fetch(isPage?'index.html':e.request,{cache:'no-store'}).then(r=>{if(r.ok)c.put(key,r.clone());return r}).catch(()=>hit);
    if(hit){e.waitUntil(net.catch(()=>{}));return hit}return net}))});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){d={body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'העוזרת של חננאל',{body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',tag:d.tag||undefined,dir:'rtl',lang:'he'}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c)return c.focus()}return clients.openWindow('./')}))});
