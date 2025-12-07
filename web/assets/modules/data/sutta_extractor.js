// Path: web/assets/modules/data/sutta_extractor.js
import { getLogger } from '../utils/logger.js';

const logger = getLogger("SuttaExtractor");

export const SuttaExtractor = {
    /**
     * Trích xuất nội dung của subleaf từ content của parent.
     * @param {Object} parentContent - Object content của bài cha (VD: an1.1-10)
     * @param {string} extractId - Prefix ID để lọc (VD: "an1.1")
     * @returns {Object} - Content object chỉ chứa các segment của subleaf
     */
    extract: function(parentContent, extractId) {
        if (!parentContent || !extractId) {
            logger.warn("extract", "Missing input", { parentContent, extractId });
            return {};
        }

        const extractedContent = {};
        const prefix = extractId + ":"; // VD: "an1.1:"

        // Duyệt qua tất cả segment của cha
        for (const [key, value] of Object.entries(parentContent)) {
            // Chỉ lấy những segment bắt đầu bằng "an1.1:"
            if (key.startsWith(prefix)) {
                extractedContent[key] = value;
            }
        }

        const count = Object.keys(extractedContent).length;
        if (count === 0) {
            logger.warn("extract", `No segments found for ${extractId} in parent content.`);
        } else {
            logger.debug("extract", `Extracted ${count} segments for ${extractId}`);
        }

        return extractedContent;
    }
};