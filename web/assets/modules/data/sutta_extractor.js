// Path: web/assets/modules/data/sutta_extractor.js

export const SuttaExtractor = {
    /**
     * Trích xuất các segment con từ nội dung cha.
     * @param {Object} parentContent - Object chứa toàn bộ segment của cha (vd: dhp1-20)
     * @param {String} extractId - ID cần trích xuất (vd: "dhp1")
     */
    extract: function(parentContent, extractId) {
        if (!parentContent || !extractId) return null;

        const extracted = {};
        const prefix = extractId + ":"; // vd: "dhp1:"
        let found = false;

        for (const [segId, data] of Object.entries(parentContent)) {
            // Kiểm tra xem segment ID có bắt đầu bằng prefix của con không
            // Ví dụ: "dhp1:1" bắt đầu bằng "dhp1:" -> Lấy
            if (segId.startsWith(prefix)) {
                extracted[segId] = data;
                found = true;
            }
        }

        return found ? extracted : null;
    }
};