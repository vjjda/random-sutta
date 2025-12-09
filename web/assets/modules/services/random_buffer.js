// Path: web/assets/modules/services/random_buffer.js
import { AppConfig } from '../core/app_config.js';
import { RandomHelper } from './random_helper.js';
import { SuttaService } from './sutta_service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("RandomBuffer");

export const RandomBuffer = {
    _buffer: [],
    _isRefilling: false,

    startBackgroundWork() {
        if (this._isRefilling) return;
        this._isRefilling = true;
        logger.info("Buffer", "Starting background buffering...");
        this._fillBuffer();
    },

    async getPayload(activeFilters) {
        // ... (Giữ nguyên logic filter stale items) ...
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

        if (this._buffer.length > 0) {
            const item = this._buffer.pop();
            logger.info("Random", `Served from Buffer: ${item.uid} (Remaining: ${this._buffer.length})`);
            this._fillBuffer(activeFilters);
            return item;
        }

        logger.info("Random", "Buffer empty, fetching directly...");
        const payload = await RandomHelper.getRandomPayload(activeFilters);
        this._fillBuffer(activeFilters); // Trigger refill
        return payload;
    },

    async _fillBuffer(filters = null) {
        if (this._buffer.length >= AppConfig.BUFFER_SIZE) return;

        try {
            const payload = await RandomHelper.getRandomPayload(filters);
            if (!payload) return;

            // [FIX] Kiểm tra kết quả load trước khi push vào buffer
            const result = await SuttaService.loadSutta(payload, { prefetchNav: false });
            
            if (result) {
                this._buffer.push(payload);
                logger.debug("Buffer", `Buffered: ${payload.uid} (Size: ${this._buffer.length})`);
            } else {
                logger.warn("Buffer", `Skipped invalid item: ${payload.uid}`);
            }
            
            if (this._buffer.length < AppConfig.BUFFER_SIZE) {
                 setTimeout(() => this._fillBuffer(filters), 100);
            }
        } catch (e) {
            logger.warn("Buffer", "Failed to buffer random sutta", e);
        }
    }
};