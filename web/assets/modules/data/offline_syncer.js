// Path: web/assets/modules/data/offline_syncer.js
import { getLogger } from '../utils/logger.js';
import { IODriver } from './io_driver.js';

const logger = getLogger("OfflineSyncer");

export const OfflineSyncer = {
    async downloadAll(uidIndex, onProgress) {
        logger.info("downloadAll", "Starting offline sync via DB Bundle...");

        try {
            // 1. Download Zip Bundle
            logger.info("downloadAll", "Fetching db_bundle.zip...");
            const response = await fetch(`assets/db/db_bundle.zip?v=${Date.now()}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch bundle: ${response.status}`);
            }
            const blob = await response.blob();

            // 2. Load JSZip
            if (!window.JSZip) {
                throw new Error("JSZip library not loaded.");
            }
            const zip = await window.JSZip.loadAsync(blob);
            
            // 3. Filter valid files (ignore directories)
            const files = Object.keys(zip.files).filter(name => !zip.files[name].dir);
            const total = files.length;
            logger.info("downloadAll", `Unzipping ${total} files into cache...`);

            // 4. Identify Cache Name
            const cacheKeys = await caches.keys();
            const suttaCaches = cacheKeys.filter(k => k.startsWith("sutta-cache-"));
            
            // Sort descending to pick the latest version (v2025...)
            suttaCaches.sort().reverse();
            const targetCacheName = suttaCaches[0];
            
            if (!targetCacheName) {
                logger.warn("downloadAll", "No active cache found. Creating a new temporary one.");
            } else {
                logger.info("downloadAll", `Writing to cache: ${targetCacheName}`);
            }

            const cacheName = targetCacheName || "sutta-cache-temp";
            const cache = await caches.open(cacheName);

            // 5. Extract and Cache
            let processed = 0;
            // Xử lý song song theo batch để tăng tốc độ nhưng không block thread
            const BATCH_SIZE = 20; 
            
            for (let i = 0; i < files.length; i += BATCH_SIZE) {
                const batch = files.slice(i, i + BATCH_SIZE);
                
                await Promise.all(batch.map(async (filename) => {
                    const fileData = await zip.file(filename).async("string"); // JSON content
                    
                    // Construct URL: current_origin + /assets/db/ + filename_in_zip
                    // Filename in zip structure: "meta/abc.json" or "content/xyz.json"
                    const targetPath = `assets/db/${filename}`;
                    const targetUrl = new URL(targetPath, window.location.href).href;
                    
                    const headers = new Headers({
                        'Content-Type': 'application/json',
                        'Content-Length': fileData.length.toString()
                    });
                    
                    // Create a synthetic response
                    const syntheticResponse = new Response(fileData, {
                        status: 200,
                        statusText: "OK",
                        headers: headers
                    });

                    await cache.put(targetUrl, syntheticResponse);
                }));

                processed += batch.length;
                if (onProgress) onProgress(processed, total);
            }

            logger.info("downloadAll", "Offline sync completed successfully.");

        } catch (e) {
            logger.error("downloadAll", `Sync failed: ${e.message}`);
            throw e;
        }
    }
};