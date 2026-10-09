/**
 * Service worker KRING! — ditulis manual (tanpa dependency).
 *
 * Strategi (lihat rencana Tahap 4 §3 butir 7):
 *  - App shell & aset statis (/_next/static, ikon, manifest): cache-first,
 *    lalu perbarui cache di latar belakang.
 *  - Halaman/HTML terautentikasi: NETWORK-FIRST, fallback ke cache saat offline.
 *    Sengaja bukan cache-first: data kasir tak boleh basi lintas sesi/tenant.
 *  - /api/**: TIDAK di-cache, kecuali GET /api/products & GET /api/settings
 *    (stale-while-revalidate) agar katalog tetap tersedia offline.
 *    Semua mutasi (POST/PATCH/DELETE/PUT) selalu lewat jaringan.
 */

// Naikkan versi ini setiap kali daftar pre-cache atau logika berubah supaya
// event `activate` membersihkan cache lama.
const CACHE_VERSION = "v1";
const SHELL_CACHE = `kring-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `kring-runtime-${CACHE_VERSION}`;
const API_CACHE = `kring-api-${CACHE_VERSION}`;

// Cache yang boleh hidup berdampingan; sisanya dibersihkan saat activate.
const CURRENT_CACHES = new Set([SHELL_CACHE, RUNTIME_CACHE, API_CACHE]);

// App shell minimal. Halaman HTML sengaja TIDAK di-pre-cache (butuh auth &
// datanya harus segar) — hanya aset statis/ikon/manifest.
const PRECACHE_URLS = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

// Endpoint GET yang boleh di-cache (stale-while-revalidate) untuk mode offline.
const SWR_API_PATHS = ["/api/products", "/api/settings"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Satu aset gagal jangan menggagalkan seluruh instalasi.
      .then((cache) =>
        Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("kring-") && !CURRENT_CACHES.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ---------------------------------------------------------------------------
// Helper strategi
// ---------------------------------------------------------------------------

// Perbarui entri cache diam-diam; kegagalan (offline) diabaikan dan tak pernah
// membocorkan error ke pemanggil.
function revalidate(cache, request) {
  fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
    })
    .catch(() => undefined);
}

// Cache-first + revalidasi latar belakang (app shell & aset statis).
async function cacheFirstWithRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    revalidate(cache, request);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const fallback = await cache.match(request);
    if (fallback) return fallback;
    throw err;
  }
}

// Network-first, fallback ke cache (HTML terautentikasi).
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    // Simpan hanya respons sukses same-origin yang bukan redirect (mis. ke
    // halaman login) agar tak menyajikan HTML login sebagai halaman terautentikasi.
    if (response && response.ok && response.type === "basic" && !response.redirected) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

// Stale-while-revalidate (GET katalog: produk & settings).
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || network;
}

function isSwrApi(url) {
  return SWR_API_PATHS.some(
    (path) => url.pathname === path || url.pathname.startsWith(path + "/"),
  );
}

// ---------------------------------------------------------------------------
// Router fetch
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Hanya tangani GET; mutasi apa pun selalu lewat jaringan (tanpa cache).
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Hanya tangani origin sendiri.
  if (url.origin !== self.location.origin) return;

  // API: default jangan di-cache; hanya katalog yang boleh SWR.
  if (url.pathname.startsWith("/api/")) {
    if (isSwrApi(url)) {
      event.respondWith(staleWhileRevalidate(request));
    }
    // Endpoint API lain dibiarkan lewat langsung (network, tanpa cache).
    return;
  }

  // Navigasi halaman / dokumen HTML → network-first.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Aset statis Next, ikon, manifest, dan aset same-origin lain → cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".css")
  ) {
    event.respondWith(cacheFirstWithRevalidate(request));
  }
});
