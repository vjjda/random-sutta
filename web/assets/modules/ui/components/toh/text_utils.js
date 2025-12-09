// Path: web/assets/modules/ui/components/toh/text_utils.js

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

/**
 * Lấy nội dung text sạch từ một element (ưu tiên .eng > .pli > textContent).
 */
export function getCleanTextContent(element) {
    let text = element.textContent;
    const engNode = element.querySelector(".eng");
    const pliNode = element.querySelector(".pli");

    if (engNode && engNode.textContent.trim()) {
        text = engNode.textContent.trim();
    } else if (pliNode && pliNode.textContent.trim()) {
        text = pliNode.textContent.trim();
    }
    
    // Xóa khoảng trắng thừa và xuống dòng
    return text.replace(/\s+/g, ' ').trim();
}