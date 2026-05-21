// Path: web/assets/modules/data/sutta_db.js
import { getLogger } from 'utils/logger.js';
import { initSQLite, getSharedSqlite, importToMemoryStorage } from 'services/sqlite_helper.js';
import { DbManifestManager } from 'data/db_manifest_manager.js';
import { DbStorageManager } from 'data/db_storage_manager.js';

const logger = getLogger("SuttaDB");

/**
 * Interface chính để truy cập Sutta Databases.
 * Đóng vai trò Facade kết nối ManifestManager, StorageManager và Connection Pool.
 */
export class SuttaDB {
    static core = null;
    static parallels = null;
    static shards = new Map();
    // Category -> DB Instance (Persistent or Remote)
    static SHARD_LIMIT = 5; 
    static isInitializing = false;
    static loadingPromises = new Map();

    /**
     * Proxy tới manifest thực tế để đảm bảo backward compatibility
     */
    static get manifest() {
        return DbManifestManager.manifest;
    }

    /**
     * Khởi động Core Database (Metadata, Structure, Config)
     */
    static async init(onProgress) {
        if (this.core) return true;
        if (this.isInitializing) return this._waitForInit();

        this.isInitializing = true;
        try {
            // [OPTIMIZED] Pre-warm WASM and VFS in parallel
            getSharedSqlite().catch(() => {});
            
            // 1. Load manifest (Cache-first)
            // [OPTIMIZED] load() already calls refreshInBackground if cache is missing.
            await DbManifestManager.load();
            
            // 2. Load Core DB
            // [HYBRID] Core DB có thể dùng Remote để App sẵn sàng ngay lập tức (< 1s)
            const dbName = "sutta_core.db";
            this.core = await this._getOrUpdateDB(dbName, onProgress, { allowRemote: true });

            this.isInitializing = false;
            
            // [Background] Check for update only when idle
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => DbManifestManager.refreshInBackground(), { timeout: 10000 });
            }

            return true;
        } catch (e) {
            logger.error("Init", "Failed to initialize Core DB", e);
            this.isInitializing = false;
            return false;
        }
    }

    /**
     * Nạp Parallels Database (Lazy Load)
     */
    static async loadParallels(onProgress) {
        if (this.parallels) return this.parallels;
        try {
            const dbName = "sutta_parallels.db";
            // Parallels cũng có thể dùng Remote
            this.parallels = await this._getOrUpdateDB(dbName, onProgress, { allowRemote: true });
            return this.parallels;
        } catch (e) {
            logger.error("LoadParallels", "Failed to load parallels DB", e);
            return null;
        }
    }

    /**
     * Nạp một Content Shard
     */
    static async loadShard(category, onProgress) {
        if (this.shards.has(category)) {
            // [LRU] Move to end
            const instance = this.shards.get(category);
            this.shards.delete(category);
            this.shards.set(category, instance);
            return instance;
        }
        
        if (this.loadingPromises.has(category)) {
             return await this.loadingPromises.get(category);
        }

        const loadPromise = (async () => {
            try {
                if (this.shards.size >= this.SHARD_LIMIT) {
                    const oldestCategory = this.shards.keys().next().value;
                    logger.info("Pool", `Shard limit reached. Closing: ${oldestCategory}`);
                    await this.closeShard(oldestCategory);
                }

                const dbName = `sutta_content_${category}.db`;
                // [HYBRID] Shard nội dung có thể load Remote ngay lập tức
                const instance = await this._getOrUpdateDB(dbName, onProgress, { allowRemote: true });
                this.shards.set(category, instance);
                return instance;
            } catch (e) {
                logger.error("LoadShard", `Failed: ${category}`, e);
                return null;
            } finally {
                this.loadingPromises.delete(category);
            }
        })();
        
        this.loadingPromises.set(category, loadPromise);
        return await loadPromise;
    }

    /**
     * Lấy DB từ Storage, cập nhật nếu cần, rồi mở kết nối.
     * [NEW] Hỗ trợ Hybrid Mode: Remote (HttpVFS) + Background Hydration.
     */
    static async _getOrUpdateDB(dbName, onProgress, options = {}) {
        const { allowRemote = false, forcePersistent = false } = options;
        const targetHash = DbManifestManager.getHash(dbName);
        const currentHash = await DbStorageManager.getStoredHash(dbName);
        const isUpToDate = currentHash === targetHash;
        let isCorrupted = false;
        
        const attemptPersistent = async () => {
            let instance = null;
            try {
                instance = await initSQLite({ dbName, mode: 'persistent' });
                if (!(await instance.isEmpty())) return instance;
                await instance.close();
            } catch (e) {
                isCorrupted = true;
                logger.warn("Storage", `Persistent DB ${dbName} bị hỏng hoặc không thể mở. Buộc fallback.`, e);
                if (instance) {
                    try { await instance.close(); } catch (err) {}
                }
            }
            return null;
        };
        
        const attemptRemote = async () => {
            logger.info("Hybrid", `Opening ${dbName} in REMOTE mode (Instant access)...`);
            try {
                const remoteInstance = await initSQLite({ 
                    dbName: `assets/db/${dbName}`, 
                    mode: 'remote' 
                });
                // Sau đó âm thầm tải về máy trong background
                this._startBackgroundHydration(dbName);
                return remoteInstance;
            } catch (e) {
                logger.error("Hybrid", `Failed to open REMOTE ${dbName}`, e);
                return null;
            }
        };
        
        const attemptMemory = async () => {
            logger.info("Hybrid", `Opening ${dbName} in MEMORY mode (Fast loading)...`);
            try {
                // [GZ-LOAD] Download gzipped file into memory
                const fileStream = await DbStorageManager.fetchFile(dbName, targetHash, onProgress);
                await importToMemoryStorage(dbName, fileStream);
                
                const memoryInstance = await initSQLite({ 
                    dbName: dbName, 
                    mode: 'memory' 
                });
                // Vẫn start hydration để session sau có thể dùng persistent
                this._startBackgroundHydration(dbName);
                return memoryInstance;
            } catch (e) {
                logger.error("Hybrid", `Failed to open MEMORY ${dbName}`, e);
                return null;
            }
        };
        
        // 1. Nếu đã có sẵn và đúng version -> Thử Persistent trước
        if (isUpToDate) {
            const instance = await attemptPersistent();
            if (instance) return instance;
        }

        // 2. Nếu cho phép Remote và không bắt buộc Persistent
        if (dbName === 'sutta_core.db' && allowRemote && !forcePersistent) {
            const instance = await attemptMemory();
            if (instance) return instance;
        }

        const hasRawDb = [
            'sutta_core.db', 
            'sutta_search.db',
            'sutta_parallels.db', 
            'sutta_content_major.db', 
            'dpd_mini.db'
        ].includes(dbName);
        
        if (allowRemote && !forcePersistent && hasRawDb) {
            const instance = await attemptRemote();
            if (instance) return instance;
        }

        // 3. Cuối cùng: Buộc phải tải về (hoặc tải lại nếu Persistent lỗi)
        try {
            logger.info("Storage", `Hydrating ${dbName} to persistent storage...`);
            
            // Self-healing: Xóa hash để buộc DbStorageManager tải lại nếu file bị hỏng
            if (isCorrupted) {
                logger.info("Storage", `Phát hiện file hỏng, cưỡng chế tải lại ${dbName}.`);
                localStorage.removeItem(`${dbName}_hash`);
                if (typeof DbStorageManager.removeHash === 'function') {
                    await DbStorageManager.removeHash(dbName);
                }
            }

            await DbStorageManager.ensureUpdated(dbName, this.manifest, onProgress);
            const instance = await attemptPersistent();
            if (instance) return instance;
            throw new Error(`Failed to open ${dbName} after hydration`);
        } catch (e) {
            logger.error("Storage", `Critical failure for ${dbName}`, e);
            throw e;
        }
    }

    /**
     * Âm thầm tải DB về máy trong background.
     */
    static async _startBackgroundHydration(dbName) {
        const start = async () => {
            try {
                logger.info("Hybrid", `Starting background hydration for ${dbName}...`);
                await DbStorageManager.ensureUpdated(dbName, this.manifest);
                logger.info("Hybrid", `Hydration complete for ${dbName}. Will use persistent next session.`);
            } catch (e) {
                logger.warn("Hybrid", `Background hydration failed for ${dbName}`, e);
            }
        };

        // Delay cực lâu (60s) để đảm bảo User đã load xong nội dung và rảnh tay hoàn toàn
        if ('requestIdleCallback' in window) {
            setTimeout(() => {
                requestIdleCallback(() => start(), { timeout: 60000 });
            }, 30000);
        } else {
            setTimeout(() => start(), 60000);
        }
    }

    /**
     * Tải Shard về máy (Offline) nhưng KHÔNG mở kết nối.
     */
    static async prefetchShard(category, onProgress) {
        if (this.shards.has(category)) {
            if (onProgress) onProgress(100, 100);
            return;
        }
        if (this.loadingPromises.has(category)) {
            await this.loadingPromises.get(category);
            if (onProgress) onProgress(100, 100);
            return;
        }
        
        const dbName = `sutta_content_${category}.db`;
        await DbStorageManager.ensureUpdated(dbName, this.manifest, onProgress);
        logger.info("Storage", `Prefetch completed for ${dbName}`);
    }

    static async closeShard(category) {
        const instance = this.shards.get(category);
        if (instance) {
            await instance.close();
            this.shards.delete(category);
        }
    }

    static async closeAll() {
        for (const category of this.shards.keys()) {
            await this.closeShard(category);
        }
        if (this.parallels) {
            await this.parallels.close();
            this.parallels = null;
        }
        if (this.search) {
            await this.search.close();
            this.search = null;
        }
        if (this.core) {
            await this.core.close();
            this.core = null;
        }
    }

    static async _waitForInit() {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (this.core) {
                    clearInterval(interval);
                    resolve(true);
                } else if (!this.isInitializing) {
                    clearInterval(interval);
                    resolve(false);
                }
            }, 50);
        });
    }

    static async query(sql, params) {
        if (!this.core) await this.init();
        return await this.core.run(sql, params);
    }

    static async querySearch(sql, params) {
        const db = await this.loadSearch();
        return db ? await db.run(sql, params) : [];
    }

    static async queryParallels(sql, params) {
        const db = await this.loadParallels();
        return db ? await db.run(sql, params) : [];
    }

    static async queryShard(category, sql, params) {
        const shard = await this.loadShard(category);
        return shard ? await shard.run(sql, params) : [];
    }

    static async runBenchmark() {
        logger.info("Benchmark", "Starting...");
        const start = performance.now();
        await this.query("SELECT * FROM metadata LIMIT 10");
        logger.info("Benchmark", `Completed in ${(performance.now() - start).toFixed(2)}ms`);
    }
}

