// Path: web/assets/modules/data/sutta_extractor.js
import { getLogger } from 'utils/logger.js';

const logger = getLogger("SuttaExtractor");

export const SuttaExtractor = {
    /**
     * Trích xuất một bài kinh con từ một tập dữ liệu lớn (Content Chunk).
     * Hỗ trợ 2 cơ chế:
     * 1. Prefix Match (Cũ): Dựa vào ID segment (vd: an1.1:1.1)
     * 2. Article Tag (Mới): Dựa vào thẻ <article id="..."> trong HTML
     */
    extract(parentContent, targetId) {
        if (!parentContent || !targetId) return null;

        // --- CHIẾN LƯỢC 1: PREFIX MATCH (Nhanh nhất) ---
        // Dành cho trường hợp targetId là prefix của segment (vd: dhp1 trích từ dhp1-20)
        // Kiểm tra nhanh segment đầu tiên khớp
        const keys = Object.keys(parentContent);
        // Sắp xếp keys để đảm bảo thứ tự (quan trọng cho việc quét HTML)
        keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        const prefixMatches = {};
        let hasPrefixMatch = false;
        
        // Regex an toàn cho prefix (thêm dấu : hoặc . để tránh an1 khớp an10)
        // Tuy nhiên với logic Article mới, ta ưu tiên quét HTML trước nếu ID trông giống Range
        
        // --- CHIẾN LƯỢC 2: HTML ARTICLE SCAN (Chính xác cho Range) ---
        // Regex bắt thẻ mở: <article ... id="targetId" ... >
        // Lưu ý: targetId có thể chứa dấu chấm, cần escape nếu dùng trong new RegExp, 
        // nhưng ở đây ta check string includes hoặc match đơn giản.
        
        // Pattern: <article (mọi thứ) id='targetId' (mọi thứ)> hoặc id="targetId"
        const startRegex = new RegExp(`<article[^>]*\\sid=['"]${this._escapeRegExp(targetId)}['"]`, 'i');
        const endRegex = /<\/article>/i;

        const articleMatches = {};
        let isCapturing = false;
        let foundArticle = false;

        for (const key of keys) {
            const segment = parentContent[key];
            const html = segment.html || "";

            // 1. Kiểm tra điểm bắt đầu
            if (!isCapturing && startRegex.test(html)) {
                isCapturing = true;
                foundArticle = true;
            }

            // 2. Đang trong trạng thái Capture
            if (isCapturing) {
                articleMatches[key] = segment;

                // 3. Kiểm tra điểm kết thúc
                // Nếu gặp thẻ đóng </article>, dừng ngay sau segment này
                if (endRegex.test(html)) {
                    isCapturing = false;
                    // Break luôn vì một file extracted chỉ chứa 1 bài kinh
                    break; 
                }
            }
        }

        if (foundArticle) {
            return articleMatches;
        }

        // --- FALLBACK: CHIẾN LƯỢC PREFIX (Nếu không tìm thấy Article Tag) ---
        // Logic cũ: Tìm những segment bắt đầu bằng targetId
        for (const key of keys) {
            // Logic match lỏng: key bắt đầu bằng targetId
            // Cần cẩn thận: targetId="an1.1" không được khớp "an1.10"
            // Quy tắc: targetId + ":" hoặc targetId là toàn bộ key (ít gặp)
            if (key === targetId || key.startsWith(targetId + ':')) {
                prefixMatches[key] = parentContent[key];
                hasPrefixMatch = true;
            }
        }

        if (hasPrefixMatch) {
            return prefixMatches;
        }

        return null;
    },

    _escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
};