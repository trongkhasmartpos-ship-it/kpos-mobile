const CACHE="kpos-mobile-v7-1";
const ASSETS=[
  "./","./index.html","./manifest.webmanifest","./icons/icon.svg",
  "./v6/css-00.txt",
  "./v6/app-00.txt","./v6/app-01.txt","./v6/app-02.txt","./v6/app-03.txt","./v6/app-04.txt","./v6/app-05.txt",
  "./v7/patch.js"
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
