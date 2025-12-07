// Path: web/assets/modules/utils/navigator_logic.js

/**
 * Làm phẳng cây structure thành danh sách đọc tuyến tính.
 * Chỉ lấy Leaf và Subleaf (bỏ qua Branch container).
 */
export function getReadingOrderList(structure) {
    let list = [];

    function traverse(node) {
        if (typeof node === 'string') {
            // Leaf (Range hoặc bài đơn)
            list.push(node);
        } else if (Array.isArray(node)) {
            // List con
            node.forEach(child => traverse(child));
        } else if (typeof node === 'object' && node !== null) {
            // Object Node (có thể là Branch hoặc Parent chứa Subleaves)
            // VD: { "an1.1-10": ["an1.1", "an1.2"] }
            // Hoặc: { "vagga1": [...] }
            
            Object.values(node).forEach(child => traverse(child));
        }
    }

    traverse(structure);
    return list;
}

export function calculateNavigation(structure, currentId) {
    // 1. Tạo danh sách đọc tuyến tính từ Structure hiện tại
    const flatList = getReadingOrderList(structure);
    
    // 2. Tìm vị trí
    const index = flatList.indexOf(currentId);
    
    if (index === -1) {
        // Trường hợp không tìm thấy (có thể do load partial structure)
        return { prev: null, next: null };
    }

    return {
        prev: index > 0 ? flatList[index - 1] : null,
        next: index < flatList.length - 1 ? flatList[index + 1] : null
    };
}