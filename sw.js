// Path: web/sw.js

// [IMPORTANT] Giữ nguyên placeholder này để Release System tự động replace bằng version tag thật
const CACHE_NAME = "sutta-cache-v2026.01.04-20.03.02";
// [NEW] Cache riêng cho Data (DB Zips) để không bị xóa khi App Version đổi
const DATA_CACHE_NAME = "sutta-data-cache";

console.log(`[SW] Startup (${CACHE_NAME})`);

// Danh sách file bắt buộc phải có để App chạy offline
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./assets/style.bundle.css",
  
  // Entry point chính
  "./assets/modules/core/app.js", 
  
  // Icons
  "./assets/icons/favicon.ico",
  "./assets/icons/favicon.svg",
  "./assets/icons/site.webmanifest",
  "./assets/icons/web-app-manifest-192x192.png",
  "./assets/icons/web-app-manifest-512x512.png",
  
  // Fonts [UPDATED] - Changed from .ttf to .woff2 to match CSS
  "./assets/fonts/NotoSans-Regular.woff2",
  "./assets/fonts/NotoSans-Italic.woff2",

  // Data
  "./assets/modules/data/constants.js",

  "./assets/modules/core/sutta_controller.js?v=v2026.01.04-20.03.02",
  "./assets/modules/core/router.js?v=v2026.01.04-20.03.02",
  "./assets/modules/core/app_config.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/lookup_manager.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/index.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/dict_provider.js?v=v2026.01.04-20.03.02",
  "./assets/modules/utils/text_splitter.js?v=v2026.01.04-20.03.02",
  "./assets/modules/utils/logger.js?v=v2026.01.04-20.03.02",
  "./assets/modules/utils/flag_util.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/tts_bootstrap.js?v=v2026.01.04-20.03.02",
  "./assets/modules/data/index_resolver.js?v=v2026.01.04-20.03.02",
  "./assets/modules/data/sutta_extractor.js?v=v2026.01.04-20.03.02",
  "./assets/modules/data/index.js?v=v2026.01.04-20.03.02",
  "./assets/modules/data/sutta_repository.js?v=v2026.01.04-20.03.02",
  "./assets/modules/data/core_network.js?v=v2026.01.04-20.03.02",
  "./assets/modules/data/content_compiler.js?v=v2026.01.04-20.03.02",
  "./assets/modules/data/zip_loader.js?v=v2026.01.04-20.03.02",
  "./assets/modules/data/db_adapter.js?v=v2026.01.04-20.03.02",
  "./assets/modules/services/sqlite_connection.js?v=v2026.01.04-20.03.02",
  "./assets/modules/services/structure_strategy.js?v=v2026.01.04-20.03.02",
  "./assets/modules/services/index.js?v=v2026.01.04-20.03.02",
  "./assets/modules/services/sutta_service.js?v=v2026.01.04-20.03.02",
  "./assets/modules/services/random_helper.js?v=v2026.01.04-20.03.02",
  "./assets/modules/services/random_buffer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/ui/tts_ui_coordinator.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/ui/tts_ui_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/ui/tts_ui_actions.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/ui/view.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/ui/tts_ui_layout.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/core/tts_state_store.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/core/tts_player.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/core/tts_session_manager.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/core/tts_marker_manager.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/core/tts_highlighter.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/core/tts_orchestrator.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/core/tts_dom_parser.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/engines/tts_gcloud_engine.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/engines/tts_web_speech_engine.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/engines/gcloud/voice_manager.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/engines/gcloud/config_manager.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/engines/gcloud/synthesizer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/engines/support/tts_gcloud_fetcher.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/engines/support/tts_cloud_audio_player.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/engines/support/tts_audio_cache.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/core/orchestrator/playback_controller.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/core/orchestrator/engine_registry.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/core/orchestrator/ui_synchronizer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/ui/renderers/player_controls_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/ui/renderers/settings_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/tts/ui/renderers/voice_list_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/ui/lookup_ui.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/core/lookup_highlighter.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/core/lookup_event_handler.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/core/lookup_state.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/core/lookup_navigator.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/dictionaries/pali_dpd.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/renderers/pali/pali_main_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/renderers/pali/pali_entry_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/renderers/pali/pali_decon_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/lookup/renderers/pali/pali_root_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/managers/font_size_manager.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/managers/drawer_manager.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/managers/index.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/managers/theme_manager.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/search.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/common/scroll_handler.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/common/scroller.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/common/swipe_handler.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/common/z_index_manager.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/common/ui_factory.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/views/renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/views/index.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/views/header_view.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/views/renderers/leaf_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/views/renderers/branch_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/filters/filter_state.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/filters/index.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/filters/filter_gestures.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/filters/filter_view.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/popup/index.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/popup/popup_orchestrator.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/toh/index.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/toh/text_utils.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/toh/toh_controller.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/toh/dom_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/toh/content_scanner.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/magic_nav/magic_nav_controller.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/magic_nav/index.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/magic_nav/ui_manager.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/magic_nav/toc_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/magic_nav/breadcrumb_renderer.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/popup/ui/quicklook_ui.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/popup/ui/comment_ui.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/popup/utils/popup_scanner.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/popup/state/popup_state.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/popup/controllers/quicklook_controller.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/popup/controllers/comment_controller.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/popup/controllers/restoration_controller.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/components/popup/controllers/navigation_controller.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/managers/offline/offline_view.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/managers/offline/index.js?v=v2026.01.04-20.03.02",
  "./assets/modules/ui/managers/offline/offline_service.js?v=v2026.01.04-20.03.02",
  "./assets/libs/chunk-XTDXRGBP.js?v=v2026.01.04-20.03.02",
  "./assets/libs/jszip.min.js?v=v2026.01.04-20.03.02",
  "./assets/libs/wa-sqlite-idb.js?v=v2026.01.04-20.03.02",
  "./assets/libs/chunk-V74BWXVI.js?v=v2026.01.04-20.03.02",
  "./assets/libs/chunk-F5DR6WUZ.js?v=v2026.01.04-20.03.02",
  "./assets/libs/wa-sqlite-index.js?v=v2026.01.04-20.03.02",
  "./assets/libs/chunk-5HQBLAUX.js?v=v2026.01.04-20.03.02",
  "./assets/libs/chunk-LGUUZUN7.js?v=v2026.01.04-20.03.02",
  "./assets/libs/chunk-EOQABE3P.js?v=v2026.01.04-20.03.02"
];

// 1. INSTALL: Tải và cache toàn bộ Shell Assets
self.addEventListener("install", (event) => {
  console.log(`[SW] Installing ${CACHE_NAME}...`);
  // Kích hoạt ngay lập tức, không chờ tab đóng
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching shell assets...");
      return cache.addAll(SHELL_ASSETS);
    })
  );
});

// 2. ACTIVATE: Dọn dẹp cache cũ và claim clients
self.addEventListener("activate", (event) => {
  console.log(`[SW] Activating ${CACHE_NAME}...`);
  event.waitUntil(
    Promise.all([
      // Claim clients để SW kiểm soát page ngay lập tức mà không cần reload
      self.clients.claim(),
      // Xóa cache cũ
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            // [FIX] Chỉ xóa App Cache cũ, KHÔNG xóa Data Cache
            if (cache !== CACHE_NAME && cache !== DATA_CACHE_NAME) {
              console.log("[SW] Deleting old cache:", cache);
              return caches.delete(cache);
            }
          })
        );
      })
    ])
  );
});

// 3. FETCH: Xử lý request
self.addEventListener("fetch", (event) => {
  const request = event.request;
  
  // Chỉ xử lý GET request
  if (request.method !== "GET") return;

  // [CHIẾN LƯỢC 1] App Shell cho Navigation (Fix lỗi Refresh Offline)
  // Áp dụng khi trình duyệt điều hướng (F5, nhập URL, click link)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          
          // A. Thử tìm chính request đó trong cache (bỏ qua query param ?q=...)
          // Ví dụ: http://.../?q=mn1 -> tìm http://.../
          let cachedResponse = await cache.match(request, { ignoreSearch: true });
          
          // B. Nếu không thấy, thử tìm đích danh "index.html"
          if (!cachedResponse) {
             cachedResponse = await cache.match("index.html");
          }
          
          // C. Nếu vẫn không thấy, thử tìm "./" (Root)
          if (!cachedResponse) {
             cachedResponse = await cache.match("./");
          }

          // D. Nếu tìm thấy bất kỳ cái nào, trả về ngay (OFFLINE FIRST)
          if (cachedResponse) {
              return cachedResponse;
          }
          
          // E. Nếu không có trong cache, buộc phải gọi mạng
          console.log("[SW] Nav not in cache, fetching:", request.url);
          return await fetch(request);

        } catch (e) {
          console.error("[SW] Fetch failed:", e);
          // F. Mạng lỗi và Cache rỗng -> Trả về trang lỗi giả lập
          // Status 200 giúp tránh màn hình "Dino" của trình duyệt
          const errorHtml = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 40px 20px; color: #333; }
                    h1 { color: #d35400; margin-bottom: 10px; }
                    p { margin-bottom: 20px; line-height: 1.5; }
                    button { padding: 12px 24px; background: #d35400; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: bold; cursor: pointer; }
                    button:active { opacity: 0.8; }
                </style>
            </head>
            <body>
                <h1>You are Offline</h1>
                <p>The application shell data is missing from your device.<br>Please check your internet connection.</p>
                <button onclick="window.location.reload()">Retry Connection</button>
            </body>
            </html>`;
          return new Response(errorHtml, { 
              status: 200, 
              headers: { "Content-Type": "text/html" } 
          });
        }
      })()
    );
    return;
  }

  // [CHIẾN LƯỢC 2] Hybrid Strategy for Assets
  event.respondWith(
    (async () => {
      // [FIX] Chọn cache bucket phù hợp
      let targetCacheName = CACHE_NAME;
      if (request.url.endsWith('.zip')) {
          targetCacheName = DATA_CACHE_NAME;
      }
      
      const cache = await caches.open(targetCacheName);
      
      // A. Network First for Manifests/DB Configs (JSON in assets/db)
      // Ensures we always get the latest hash check
      if (request.url.includes('assets/db/') && request.url.includes('.json')) {
          try {
              const networkResponse = await fetch(request);
              if (networkResponse && networkResponse.status === 200) {
                  cache.put(request, networkResponse.clone());
                  return networkResponse;
              }
          } catch (e) {
              console.log("[SW] Network First failed for manifest, falling back to cache.");
          }
          // Fallback to cache
          return await cache.match(request) || new Response("Offline", { status: 408 });
      }

      // B. Cache First for everything else (JS, CSS, Images, WOFF2, ZIPs)
      // 1. Tìm trong cache trước (bỏ qua search param để match version tag ?v=...)
      const cachedResponse = await cache.match(request, { ignoreSearch: true });
      if (cachedResponse) return cachedResponse;

      // 2. Nếu không có, gọi mạng và cache lại
      try {
        const networkResponse = await fetch(request);
        
        // Chỉ cache những response thành công và đúng loại
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // Fallback đơn giản cho asset
        console.log("[SW] Asset fetch failed:", request.url);
        return new Response("Offline", { status: 408 });
      }
    })()
  );
});