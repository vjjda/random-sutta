// Path: web/assets/modules/navigator.js

/**
 * Thu thập tất cả Leaf (bài kinh) theo thứ tự tuyến tính.
 * Dùng cho điều hướng bài đọc (Leaf -> Leaf).
 */
export function getFlatLeafList(structure) {
    let list = [];
    
    function traverse(node) {
        if (typeof node === 'string') {
            list.push(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => traverse(child));
        } else if (typeof node === 'object' && node !== null) {
            Object.values(node).forEach(child => traverse(child));
        }
    }
    
    traverse(structure);
    return list;
}

/**
 * Thu thập tất cả Branch (mục lục) cùng với độ sâu (depth) của chúng.
 * Trả về:Array<{id: string, depth: number}>
 */
function getFlatBranchListWithDepth(structure) {
    let list = [];

    function traverse(node, currentDepth) {
        if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
            // Đây là Branch (Object key)
            Object.keys(node).forEach(key => {
                // Thêm branch hiện tại vào list
                list.push({ id: key, depth: currentDepth });
                
                // Đệ quy xuống con (depth + 1)
                traverse(node[key], currentDepth + 1);
            });
        } else if (Array.isArray(node)) {
            // Mảng con (thường là trong branch), không tăng depth vì nó chỉ là wrapper
            node.forEach(child => traverse(child, currentDepth));
        }
        // Leaf (string) thì bỏ qua, ta đang tìm Branch
    }

    // Bắt đầu duyệt. Root depth coi như là 0.
    traverse(structure, 0);
    return list;
}

/**
 * Logic điều hướng thông minh.
 * - Nếu là Leaf: Next/Prev theo danh sách phẳng toàn bộ kinh.
 * - Nếu là Branch: Next/Prev theo danh sách các Branch CÙNG ĐỘ SÂU (Same Depth).
 */
export function calculateNavigation(structure, currentId) {
    // 1. Xác định xem currentId là Leaf hay Branch trong cây này
    // Cách đơn giản: Tìm trong danh sách Leaf trước
    const leafList = getFlatLeafList(structure);
    const leafIndex = leafList.indexOf(currentId);

    if (leafIndex !== -1) {
        // --- CASE 1: LEAF NAVIGATION (Tuyến tính) ---
        return {
            prev: leafIndex > 0 ? leafList[leafIndex - 1] : null,
            next: leafIndex < leafList.length - 1 ? leafList[leafIndex + 1] : null,
            type: 'leaf'
        };
    } else {
        // --- CASE 2: BRANCH NAVIGATION (Theo Depth) ---
        // Lấy toàn bộ danh sách branch kèm depth
        const branchList = getFlatBranchListWithDepth(structure);
        
        // Tìm node hiện tại
        const currentNode = branchList.find(item => item.id === currentId);
        
        if (!currentNode) {
            return { prev: null, next: null, type: 'unknown' };
        }

        // Lọc ra những ông nào có CÙNG DEPTH với ông hiện tại
        // Đây chính là logic "Siblings + Cousins" mà bạn muốn
        const sameDepthPeers = branchList.filter(item => item.depth === currentNode.depth);
        
        // Tìm vị trí của mình trong nhóm cùng cấp đó
        const myIndex = sameDepthPeers.findIndex(item => item.id === currentId);
        
        const prevNode = myIndex > 0 ? sameDepthPeers[myIndex - 1] : null;
        const nextNode = myIndex < sameDepthPeers.length - 1 ? sameDepthPeers[myIndex + 1] : null;

        return {
            prev: prevNode ? prevNode.id : null,
            next: nextNode ? nextNode.id : null,
            type: 'branch'
        };
    }
}