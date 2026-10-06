const CACHE="kpos-mobile-v8-system-audit-pack-1";
const ASSETS=[
  "./","./index.html","./manifest.webmanifest","./icons/icon.svg",
  "./supabase/config.js",
  "./v6/css-00.txt",
  "./v6/app-00.txt","./v6/app-01.txt","./v6/app-02.txt","./v6/app-03.txt","./v6/app-04.txt","./v6/app-05.txt",
  "./v7/patch.js","./v8/patch.js","./v8/diagnostics.js",
  "./desktop/desktop.css","./desktop/desktop.js","./desktop/pro.css","./desktop/pro.js","./desktop/pro-fix.js",
  "./desktop/business.css","./desktop/sales.js","./desktop/ops.js","./desktop/finish.css","./desktop/finish.js",
  "./desktop/returns.css","./desktop/returns.js","./desktop/loyalty.css","./desktop/loyalty.js",
  "./desktop/foundation.css","./desktop/foundation.js","./desktop/table-pack.css","./desktop/table-pack.js",
  "./desktop/system-audit.css","./desktop/system-audit.js"
];
self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener("activate",event=>{
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  ]));
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  if(req.mode==="navigate"){
    event.respondWith(fetch(req).then(res=>{
      const copy=res.clone();caches.open(CACHE).then(c=>c.put("./index.html",copy));return res;
    }).catch(()=>caches.match("./index.html")));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res;
  })));
});
