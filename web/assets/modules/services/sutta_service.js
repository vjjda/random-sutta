// Path: web/assets/modules/services/sutta_service.js
import { SuttaRepository } from '../data/sutta_repository.js';
import { SuttaExtractor } from '../data/sutta_extractor.js';
import { getLogger } from '../utils/logger.js';
import { RandomHelper } from './random_helper.js'; // [NEW]

const logger = getLogger("SuttaService");

export const SuttaService = {
    _randomBuffer: [], // [NEW] Buffer for preloaded random suttas
    _bgWorkStarted: false,
    
    async init() {
        await SuttaRepository.init();
        RandomHelper.init(); // [NEW] Delegate init
        // Buffer initiation is now deferred to startBackgroundWork()
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
        if (this._randomBuffer.length >= 5) return;

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
            if (this._randomBuffer.length < 5) {
                 this._fillBuffer(filters); 
            }
        } catch (e) {
            logger.warn("Buffer", "Failed to buffer random sutta", e);
        }
    },

    // [UPDATED] Get from Buffer if available
    async getRandomPayload(activeFilters) {
        // 1. Try to pop from buffer
        if (this._randomBuffer.length > 0) {
             // Simple check: In a real app, we might check if buffered item matches current filters.
             // For now, assuming filters change rarely, we just pop.
             const item = this._randomBuffer.pop();
             logger.info("Random", `Served from Buffer: ${item.uid} (Remaining: ${this._randomBuffer.length})`);
             
             // Refill in background
             this._fillBuffer(activeFilters);
             return item;
        }

        // 2. Fallback (Slow path)
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
            let loc = SuttaRepository.getLocation(uid);
            
            if (!loc) {
                await SuttaRepository.ensureIndex();
                loc = SuttaRepository.getLocation(uid);
            }

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
        const neighborsToFetch = [];
        if (nav.prev) neighborsToFetch.push(nav.prev);
        if (nav.next) neighborsToFetch.push(nav.next);

        let navMeta = {};
        if (neighborsToFetch.length > 0) {
            navMeta = await SuttaRepository.fetchMetaList(neighborsToFetch);
            
            // [NEW] Smart Prefetch for Neighbors
            if (options.prefetchNav) {
                neighborsToFetch.forEach(neighborUid => {
                    // Optimization: Check if neighbor is in the same chunk
                    const loc = SuttaRepository.getLocation(neighborUid);
                    if (loc) {
                        const [nBook, nChunk] = loc;
                        // Nếu cùng Book và cùng Chunk với bài hiện tại -> Bỏ qua (vì đã có trong RAM)
                        if (nBook === hintBook && nChunk === hintChunk) {
                            return; 
                        }
                    }

                    // Fire-and-forget load to warm up cache for NEW chunks
                    this.loadSutta(neighborUid, { prefetchNav: false })
                        .catch(e => logger.warn("Prefetch", `Failed to prefetch ${neighborUid}`));
                });
            }
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