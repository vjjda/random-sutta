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
        const cacheName = keys.find(k => k.startsWith("sutta-cache-"));
        
        if (!cacheName) {
            throw new Error("No active cache found. Please reload page.");
        }
        
        const cache = await caches.open(cacheName);
        
        // 3. Tải file Zip
        const zipUrl = 'assets/db/db_bundle.zip'; // Lưu URL để dùng lại
        logger.info("Run", "Downloading db_bundle.zip...");
        const response = await fetch(zipUrl);
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
        
        // [NEW] 6. Cleanup: Xóa file zip gốc khỏi cache
        // Vì SW tự động cache mọi request GET, nên file zip này đang nằm trong cache.
        // Xóa nó đi để tiết kiệm dung lượng (vì ta đã có nội dung giải nén rồi).
        try {
            const wasDeleted = await cache.delete(zipUrl);
            if (wasDeleted) {
                logger.info("Run", "🧹 Cleaned up temporary db_bundle.zip from cache.");
            } else {
                // Trường hợp fetch chưa kịp cache hoặc SW không cache file lớn
                logger.info("Run", "db_bundle.zip was not in cache (skipped cleanup).");
            }
        } catch (e) {
            logger.warn("Run", "Failed to cleanup zip file", e);
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