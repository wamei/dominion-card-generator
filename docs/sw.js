// Names of the caches used in this version of the service worker.
// Increase chache number when you update any of the local resources, which will in turn trigger the install event again.
const PRECACHE_CORE = "precache-core-v320";
const PRECACHE_CARD = "precache-card-v7";
const PRECACHE_LIBS = "precache-libs-v5";
const RUNTIME = "runtime";

// A list of local resources we always want to be cached.
const OFFLINE_URL = "./";
const PRECACHE_CORE_URLS = [
  "index.html",
  "main.js",
  "style.css",
  "fonts/font-title.css",
  "fonts/font-title-en.css",
  "fonts/font-specials.css",
  "fonts/font-text.css",
  "fonts/font-text-bold.css",
  "fonts/font-credit.css",
  "favicon/favicon.ico",
  "favicon/site.webmanifest",
  "assets/spear-left.png",
  "assets/spear-right.png",
  "assets/spinner.png",
  OFFLINE_URL,
];
const PRECACHE_LIBS_URLS = ["https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js", "https://unpkg.com/jszip@3/dist/jszip.min.js", "https://unpkg.com/dexie@3/dist/dexie.min.js"];
const PRECACHE_CARD_URLS = [
  "card-resources/BaseCardBrown.png",
  "card-resources/BaseCardColorOne.png",
  "card-resources/BaseCardGray.png",
  "card-resources/BaseCardIcon.png",
  "card-resources/CardBrown.png",
  "card-resources/CardColorOne.png",
  "card-resources/CardColorTwo.png",
  "card-resources/CardColorThree.png",
  "card-resources/CardColorTwoNight.png",
  "card-resources/CardColorTwoBig.png",
  "card-resources/CardColorTwoSmall.png",
  "card-resources/CardGray.png",
  "card-resources/CardPortraitIcon.png",
  "card-resources/DoubleColorOne.png",
  "card-resources/DoubleUncoloredDetails.png",
  "card-resources/EventBrown.png",
  "card-resources/EventBrown2.png",
  "card-resources/EventColorOne.png",
  "card-resources/EventColorTwo.png",
  "card-resources/EventHeirloom.png",
  "card-resources/Heirloom.png",
  "card-resources/DescriptionFocus.png",
  "card-resources/MatBannerBottom.png",
  "card-resources/MatBannerTop.png",
  "card-resources/MatIcon.png",
  "card-resources/PileMarkerColorOne.png",
  "card-resources/PileMarkerGrey.png",
  "card-resources/PileMarkerIcon.png",
  "card-resources/TraitBrown.png",
  "card-resources/TraitBrownSide.png",
  "card-resources/TraitColorOne.png",
  "card-resources/TraitColorOneSide.png",
  "card-resources/Coin.png",
  "card-resources/Debt.png",
  "card-resources/Potion.png",
  "card-resources/VP.png",
  "card-resources/VP-Token.png",
  "card-resources/Sun.png",
  "card-resources/Traveller.png",
];

// The install handler takes care of precaching the resources we always need.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE_CORE)
      .then((cache) => cache.addAll(PRECACHE_CORE_URLS))
      .then(self.skipWaiting()),
  );
  event.waitUntil(
    caches
      .open(PRECACHE_CARD)
      .then((cache) => cache.addAll(PRECACHE_CARD_URLS))
      .then(self.skipWaiting()),
  );
  // Cache external libraries individually - failures are ignored
  event.waitUntil(
    caches.open(PRECACHE_LIBS).then((cache) => {
      return Promise.all(
        PRECACHE_LIBS_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("Failed to cache:", url, err);
          }),
        ),
      );
    }),
  );
});

// The activate handler takes care of cleaning up old caches.
self.addEventListener("activate", (event) => {
  const currentCaches = [PRECACHE_CORE, PRECACHE_CARD, PRECACHE_LIBS, RUNTIME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
      })
      .then((cachesToDelete) => {
        return Promise.all(
          cachesToDelete.map((cacheToDelete) => {
            return caches.delete(cacheToDelete);
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Check if URL is a precached library
const isLibraryUrl = (url) => {
  return PRECACHE_LIBS_URLS.some((libUrl) => url === libUrl);
};

// The fetch handler uses "Stale While Revalidate" strategy for core files.
// Returns cached response immediately, then updates cache in background.
self.addEventListener("fetch", (event) => {
  // Handle library URLs (external CDN)
  if (isLibraryUrl(event.request.url)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(PRECACHE_LIBS).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      }),
    );
    return;
  }

  // Skip other cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip query string URLs (redundant cache)
  if (event.request.url.startsWith("https://wamei.github.io/dominion-card-generator/?") || event.request.url.startsWith("https://wamei.github.io/dominion-card-generator/index.html?")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Start fetching from network in background
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Update the cache with the new response
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(RUNTIME).then((cache) => {
              cache.put(event.request, responseToCache);
              console.debug("Cache updated:", event.request.url);
            });
          }
          return networkResponse;
        })
        .catch((error) => {
          console.warn("Network fetch failed:", event.request.url, error);
          // If we have a cached response, it was already returned
          // If not, return offline page
          if (!cachedResponse) {
            return caches.match(OFFLINE_URL);
          }
        });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    }),
  );
});
