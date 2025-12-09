// Path: web/assets/modules/ui/components/toh/toh_utils.js

/**
 * Trích xuất số đoạn từ Segment ID.
 * Hỗ trợ cả số đơn (3) và phạm vi (9-15).
 * Ví dụ: "mn10:3.1" -> "3"
 * Ví dụ: "mn3:9-15.1" -> "9-15"
 */
export function extractParagraphNumber(segmentId) {
    if (!segmentId) return "";
    try {
        const parts = segmentId.split(':');
        if (parts.length < 2) return ""; 
        
        const suffix = parts[1];
        // Lấy phần trước dấu chấm đầu tiên
        const numberOrRange = suffix.split('.')[0];
        
        // Regex: Chấp nhận số (3) hoặc phạm vi số (9-15)
        if (/^\d+(-\d+)?$/.test(numberOrRange)) {
            return numberOrRange;
        }
        return "";
    } catch (e) {
        return "";
    }
}