# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dominion Card Image Generator — a vanilla JS web app for generating fan card mockups for the Dominion card game. Hosted on GitHub Pages from the `docs/` directory. No build system, no package manager, no test framework.

## Development

Open `docs/index.html` in a browser. All source lives under `docs/`.

**Service Worker**: `docs/sw.js` uses stale-while-revalidate caching. **Increment `PRECACHE_CORE` version** on every `main.js` or `style.css` change, or users won't get updates.

## Architecture

### Single-file application (`docs/main.js`, ~6300 lines)

The app is a monolithic vanilla JS file organized as:

1. **`initCardImageGenerator()`** — Main entry point. Initializes canvas rendering, font loading, and favorites system.

2. **Card Rendering Pipeline**: Form inputs → `queueDraw()` (debounced) → `draw()` → Canvas 2D API. Three canvases rendered simultaneously: portrait (1403×2151), landscape (2151×1403), mat (928×684). Card templates are recolored dynamically based on card type.

3. **`Favorites` (function-based class)** — Manages the favorites modal with list/thumbnail views, search, multi-column sort, import/export (JSON/PDF/ZIP). Uses Dexie.js (IndexedDB wrapper). 882 official Dominion cards are auto-imported on first load.

4. **`FontHandler` (ES6 class)** — Custom font management dialog (Google Fonts or file upload).

5. **`CardDatabase` (static methods on Dexie subclass)** — `buildDataFromForm()`, `getData()`, `getParams()`, `dataToParams()`. Cards are serialized as URL query parameters for sharing.

### Thumbnail System (iOS-critical)

The thumbnail virtual scroll system is the most sensitive area of the codebase. Key components:

- **`renderThumbnailPlaceholder`**: Lightweight empty div — used for bulk creation (882 cards) and off-screen unloading. Must stay minimal to avoid iOS OOM.
- **`renderDetailedPlaceholder`**: Card info placeholder (expansion, cost, title, type, description) — used only in `renderThumbnailContent` while individual thumbnails load.
- **`connectThumbnailObserver`**: Creates IntersectionObserver with double-rAF for iOS layout stability. The observer reference is captured locally to prevent stale rAF callbacks from reactivating disconnected observers.
- **`processThumbnailQueue`**: Sequential processing with 50ms mobile delay. Checks modal visibility to prevent background loading.

### iOS Memory Management (Critical)

iOS WebKit has strict process memory limits (~1.5GB). Key rules:

- **Never use base64 data URLs directly on `img.src`** — decoded bitmaps stay in WebKit cache indefinitely. Always use: `fetch(dataUrl)` → `.blob()` → `URL.createObjectURL(blob)` → `img.onload = () => URL.revokeObjectURL(objectUrl)`. This pattern is in `renderThumbnailContent` and must not be lost during edits.
- **Clear thumbnail DOM before heavy operations** — `load()` clears `favThumbnails` before loading full-size card images to free decoded bitmap memory.
- **Disconnect observer before hiding modal** — prevents mass placeholder reset (hidden root → all non-intersecting).
- **Null observer on disconnect** — `thumbnailObserver = null` in `open()`, `close()`, `load()` to invalidate pending double-rAF callbacks.

### Data Storage

- **IndexedDB via Dexie**: `favorites` (card data), `live_images` (current editor images), `thumbnails` (PNG thumbnail cache)
- **localStorage**: View mode, search term, sort state, font settings, official card timestamps
- **URL params**: Card data serialized as query string for sharing

## Key Patterns

- UI language is Japanese
- Cards are serialized as URL query parameters (`?title=...&description=...&type=...`)
- `CORS_ANYWHERE_BASE_URL` (images.weserv.nl) proxies external images to avoid CORS
- `isMobile()` checks viewport width + user agent for mobile-specific behavior
- Commit messages use conventional format: `fix:`, `Update`
