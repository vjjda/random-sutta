// Path: web/assets/modules/data/loader/zip_importer.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("ZipImporter");

export const ZipImporter = {
    async run(onProgress) {
        // 1. Kiểm tra thư viện JSZip
        if (!window.JSZip) {
            await this._loadLibrary();
        }

        // 2. Xác định Cache Name
        const keys = await caches.keys();
        // [FIX] Sửa điều kiện để khớp với cả 'sutta-cache-v...' và 'sutta-cache-dev-placeholder'
        const cacheName = keys.find(k => k.startsWith("sutta-cache-"));
        
        if (!cacheName) {
            throw new Error("No active cache found. Please reload page.");
        }
        
        const cache = await caches.open(cacheName);
        
        // 3. Tải file Zip
        logger.info("Run", "Downloading db_bundle.zip...");
        const response = await fetch('assets/db/db_bundle.zip');
        if (!response.ok) throw new Error("Failed to download DB bundle");
        
        const blob = await response.blob();
        
        // 4. Giải nén
        logger.info("Run", "Unzipping...");
        const zip = await window.JSZip.loadAsync(blob);
        
        // 5. Bơm vào Cache Storage
        const files = Object.keys(zip.files);
        let count = 0;
        const total = files.length;
        
        const BATCH_SIZE = 50;
        
        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (filename) => {
                const file = zip.files[filename];
                if (file.dir) return;

                const content = await file.async("string");
                
                const requestUrl = `assets/db/${filename}`;
                const jsonResponse = new Response(content, {
                    headers: { "Content-Type": "application/json" }
                });
                
                await cache.put(requestUrl, jsonResponse);
            }));

            count += batch.length;
            if (onProgress) onProgress(Math.min(count, total), total);
            
            await new Promise(r => setTimeout(r, 0));
        }
        
        logger.info("Run", `Imported ${total} files into Cache Storage.`);
    },

    async _loadLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'assets/libs/jszip.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error("Failed to load JSZip"));
            document.body.appendChild(script);
        });
    }
};