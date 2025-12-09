// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { getLogger } from '../utils/logger.js';
import { RandomHelper } from './random_helper.js'; 
import { AppConfig } from '../core/app_config.js'; // [NEW]

const logger = getLogger("SuttaService");

export const SuttaService = {
    _randomBuffer: [], 
    _bgWorkStarted: false,
    
    async init() {
        await SuttaRepository.init();
        RandomHelper.init(); 
    },

    // [NEW] Explicitly start background tasks (Buffer, Preload, etc.)
    startBackgroundWork() {
        if (this._bgWorkStarted) return;
        this._bgWorkStarted = true;
        
        logger.info("Service", "Starting background buffering...");
        this._fillBuffer();
    },

    // [NEW] Background buffering logic
    async _fillBuffer(filters = null) {
        if (this._randomBuffer.length >= AppConfig.BUFFER_SIZE) return;

        try {
            // Get candidate (lightweight)
            const payload = await RandomHelper.getRandomPayload(filters);
            if (!payload) return;

            // Pre-fetch data (heavyweight)
            // [UPDATED] Disable Nav Prefetch for random buffer to save bandwidth
            await this.loadSutta(payload, { prefetchNav: false });

            this._randomBuffer.push(payload);
            logger.info("Buffer", `Buffered: ${payload.uid} (Buffer Size: ${this._randomBuffer.length})`);
            
            // Recursive fill if still low
            if (this._randomBuffer.length < AppConfig.BUFFER_SIZE) {
                 this._fillBuffer(filters); 
            }
        } catch (e) {
            logger.warn("Buffer", "Failed to buffer random sutta", e);
        }
    },

    // [UPDATED] Get from Buffer if available
    async getRandomPayload(activeFilters) {
        // 1. Clean buffer of mismatched items (Stale Buffer Fix)
        if (activeFilters && activeFilters.length > 0) {
            const originalLength = this._randomBuffer.length;
            this._randomBuffer = this._randomBuffer.filter(item => {
                const match = item.uid.match(/^[a-z]+/i);
                const bookId = match ? match[0].toLowerCase() : '';
                return activeFilters.includes(bookId);
            });
            
            if (this._randomBuffer.length < originalLength) {
                logger.info("Buffer", `Cleaned ${originalLength - this._randomBuffer.length} stale items.`);
            }
        }

        // 2. Try to pop from buffer
        if (this._randomBuffer.length > 0) {
             // Simple check: In a real app, we might check if buffered item matches current filters.
             // For now, assuming filters change rarely, we just pop.
             const item = this._randomBuffer.pop();
             logger.info("Random", `Served from Buffer: ${item.uid} (Remaining: ${this._randomBuffer.length})`);
             
             // Refill in background
             this._fillBuffer(activeFilters);
             return item;
        }

        // 3. Fallback (Slow path)
        const payload = await RandomHelper.getRandomPayload(activeFilters);
        
        // Refill for next time
        this._fillBuffer(activeFilters);
        
        return payload;
    },

    // --- CORE LOGIC: LOAD CONTENT ---
    async loadSutta(input, options = { prefetchNav: true }) {
        let uid, hintChunk = null, hintBook = null;

        if (typeof input === 'object') {
            uid = input.uid;
            hintChunk = input.chunk || null;
            hintBook = input.book_id || null;
        } else {
            uid = input;
        }

        // 1. Locate
        if (hintBook === null || hintChunk === null) {
            let loc = await SuttaRepository.resolveLocation(uid);
            
            if (!loc) {
                logger.warn("loadSutta", `UID not found in index: ${uid}`);
                return null;
            }
            [hintBook, hintChunk] = loc;
        }

        // 2. Fetch Data
        const promises = [SuttaRepository.fetchMeta(hintBook)];
        if (hintChunk !== null) {
            promises.push(SuttaRepository.fetchContentChunk(hintBook, hintChunk));
        }

        const [bookMeta, contentChunk] = await Promise.all(promises);
        if (!bookMeta) return null;

        const metaEntry = bookMeta.meta[uid];
        if (!metaEntry) return null;

        // 3. Alias
        if (metaEntry.type === 'alias') {
            return { isAlias: true, targetUid: metaEntry.target_uid };
        }

        // 4. Extract
        let content = null;
        if (contentChunk) {
            if (contentChunk[uid]) {
                content = contentChunk[uid];
            } 
            else if (metaEntry.parent_uid && contentChunk[metaEntry.parent_uid]) {
                const parentContent = contentChunk[metaEntry.parent_uid];
                const extractKey = metaEntry.extract_id || uid;
                content = SuttaExtractor.extract(parentContent, extractKey);
            }
        }

        // 5. Nav
        const nav = metaEntry.nav || {};
        const navMeta = {};
        const neighborsToFetch = [];

        const checkAndAdd = (nid) => {
            if (!nid) return;
            if (bookMeta.meta[nid]) {
                navMeta[nid] = bookMeta.meta[nid];
            } else {
                neighborsToFetch.push(nid);
            }
        };

        checkAndAdd(nav.prev);
        checkAndAdd(nav.next);

        if (neighborsToFetch.length > 0) {
            const extraMeta = await SuttaRepository.fetchMetaList(neighborsToFetch);
            Object.assign(navMeta, extraMeta);
            
            // [NEW] Smart Prefetch for Neighbors (External)
            if (options.prefetchNav) {
                neighborsToFetch.forEach(neighborUid => {
                     this.loadSutta(neighborUid, { prefetchNav: false })
                        .catch(e => logger.warn("Prefetch", `Failed to prefetch ${neighborUid}`));
                });
            }
        }
        
        // Prefetch for internal neighbors (already in meta, but content might need fetching)
        if (options.prefetchNav) {
             [nav.prev, nav.next].forEach(nid => {
                 if (nid && bookMeta.meta[nid]) { // Only if it was internal
                     // Internal check optimization logic handles same-chunk skip inside loadSutta
                     this.loadSutta(nid, { prefetchNav: false }).catch(() => {});
                 }
             });
        }

        return {
            uid: uid,
            meta: metaEntry,
            content: content,
            root_title: bookMeta.super_book_title || bookMeta.title,
            book_title: bookMeta.title,
            tree: bookMeta.tree,
            bookStructure: bookMeta.tree,
            contextMeta: bookMeta.meta,
            nav: nav,
            navMeta: navMeta
        };
    }
};