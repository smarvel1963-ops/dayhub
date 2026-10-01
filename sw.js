/* SAVE AS: sw.js · LOCATION: C:/MarvelApps/dayhub/sw.js
 * Makes Day Hub installable and opens it offline (the app shell only;
 * weather needs a connection).
 * NETWORK FIRST, cache as the fallback: the first build was cache-first and a
 * fix to app.js did not show until every tab closed - users would sit on an
 * old version after each update. Online = always the newest files. */
const CACHE = "dayhub-v0.3";
const SHELL = ["./", "index.html", "styles.css", "app.js", "manifest.json"];
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
});
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== "GET") return;   // weather API: always live
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
