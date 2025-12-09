// Path: web/assets/modules/services/random_buffer.js
import { AppConfig } from '../core/app_config.js';
import { RandomHelper } from './random_helper.js';
import { SuttaService } from './sutta_service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("RandomBuffer");

export const RandomBuffer = {
    _buffer: [],
    _isRefilling: false,

    /**
     * Khởi động quá trình buffer ngẫu nhiên
     */
    startBackgroundWork() {
        if (this._isRefilling) return;
        this._isRefilling = true;
        logger.info("Buffer", "Starting background buffering...");
        this._fillBuffer();
    },

    /**
     * Lấy một item ngẫu nhiên (ưu tiên từ buffer)
     */
    async getPayload(activeFilters) {
        // 1. Clean buffer of mismatched items (Stale Buffer Fix)
        if (activeFilters && activeFilters.length > 0) {
            const originalLength = this._buffer.length;
            this._buffer = this._buffer.filter(item => {
                const match = item.uid.match(/^[a-z]+/i);
                const bookId = match ? match[0].toLowerCase() : '';
                return activeFilters.includes(bookId);
            });
            if (this._buffer.length < originalLength) {
                logger.info("Buffer", `Cleaned ${originalLength - this._buffer.length} stale items.`);
            }
        }

        // 2. Try to pop from buffer
        if (this._buffer.length > 0) {
            const item = this._buffer.pop();
            logger.info("Random", `Served from Buffer: ${item.uid} (Remaining: ${this._buffer.length})`);
            
            // Refill in background
            this._fillBuffer(activeFilters);
            return item;
        }

        // 3. Fallback (Slow path - Direct fetch logic via Helper)
        logger.info("Random", "Buffer empty, fetching directly...");
        const payload = await RandomHelper.getRandomPayload(activeFilters);
        
        // Trigger refill for next time
        this._fillBuffer(activeFilters);
        
        return payload;
    },

    /**
     * Logic nội bộ để fill buffer
     */
    async _fillBuffer(filters = null) {
        if (this._buffer.length >= AppConfig.BUFFER_SIZE) return;

        try {
            // Get candidate (lightweight)
            const payload = await RandomHelper.getRandomPayload(filters);
            if (!payload) return;

            // Pre-fetch data (heavyweight) via Service
            // Disable Nav Prefetch for random buffer to save bandwidth
            await SuttaService.loadSutta(payload, { prefetchNav: false });
            
            this._buffer.push(payload);
            logger.debug("Buffer", `Buffered: ${payload.uid} (Size: ${this._buffer.length})`);
            
            // Recursive fill if still low
            if (this._buffer.length < AppConfig.BUFFER_SIZE) {
                 // Yield to main thread using setTimeout logic equivalent
                 setTimeout(() => this._fillBuffer(filters), 100);
            }
        } catch (e) {
            logger.warn("Buffer", "Failed to buffer random sutta", e);
        }
    }
};