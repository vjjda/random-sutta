/* Path: web/assets/modules/services/random_buffer.js */
import { AppConfig } from '../core/app_config.js';
import { RandomHelper } from './random_helper.js';
import { SuttaService } from './sutta_service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger("RandomBuffer");

export const RandomBuffer = {
    _buffer: [],
    _isRefilling: false,
    _refillTimer: null, // [NEW] Biến lưu timer để debounce

    startBackgroundWork() {
        if (this._isRefilling) return;
        this._isRefilling = true;
        logger.info("Buffer", "Starting background buffering...");
        this._fillBuffer();
    },

    async getPayload(activeFilters) {
        // ... (Giữ nguyên logic filter cũ) ...
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
            
            // [UPDATED] Gọi schedule refill (đã có debounce)
            this._scheduleRefill(activeFilters);
            
            return item;
        }

        logger.info("Random", "Buffer empty, fetching directly...");
        const payload = await RandomHelper.getRandomPayload(activeFilters);
        
        this._scheduleRefill(activeFilters);
        return payload;
    },

    // [UPDATED] Helper Debounce
    _scheduleRefill(filters) {
        // 1. Nếu có timer cũ đang chờ, HỦY nó ngay
        if (this._refillTimer) {
            clearTimeout(this._refillTimer);
            this._refillTimer = null;
        }

        // 2. Thiết lập timer mới
        this._refillTimer = setTimeout(() => {
            // Dùng requestIdleCallback nếu có
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => this._fillBuffer(filters), { timeout: 2000 });
            } else {
                this._fillBuffer(filters);
            }
            // Reset timer sau khi đã chạy
            this._refillTimer = null;
        }, 1000); 
    },

    async _fillBuffer(filters = null) {
        if (this._buffer.length >= AppConfig.BUFFER_SIZE) return;

        try {
            // ... (Giữ nguyên logic bên trong) ...
            const payload = await RandomHelper.getRandomPayload(filters);
            if (!payload) return;

            const result = await SuttaService.loadSutta(payload, { prefetchNav: false });

            if (result) {
                this._buffer.push(payload);
                logger.debug("Buffer", `Buffered: ${payload.uid} (Size: ${this._buffer.length})`);
            } else {
                logger.warn("Buffer", `Skipped invalid item: ${payload.uid}`);
            }
            
            if (this._buffer.length < AppConfig.BUFFER_SIZE) {
                 // Gọi trực tiếp fillBuffer tiếp theo (đệ quy) thay vì schedule
                 // Để khi đã bắt đầu nạp là nạp một mạch cho đầy luôn
                 if ('requestIdleCallback' in window) {
                     requestIdleCallback(() => this._fillBuffer(filters));
                 } else {
                     setTimeout(() => this._fillBuffer(filters), 100);
                 }
            }
        } catch (e) {
            logger.warn("Buffer", "Failed to buffer random sutta", e);
        }
    }
};