// Path: web/assets/modules/utils/navigator_logic.js

// --- HELPERS ---

// Kiểm tra xem node có phải là dạng { "dhp1-20": ["dhp1", "dhp2"...] } không
function isSubleafContainer(node) {
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
        const keys = Object.keys(node);
        if (keys.length === 1 && Array.isArray(node[keys[0]])) {
            return true;
        }
    }
    return false;
}

// Lấy danh sách toàn bộ các Leaf (chuỗi)
function getLeafList(structure) {
    let list = [];
    function traverse(node) {
        if (typeof node === 'string') {
            list.push(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => traverse(child));
        } else if (typeof node === 'object' && node !== null) {
            // Duyệt sâu vào values để tìm leaf ẩn trong wrapper
            Object.values(node).forEach(child => traverse(child));
        }
    }
    traverse(structure);
    return list;
}

// --- LOGIC SUBLEAF (Xử lý điều hướng bên trong mảng con) ---
function getSubleafNavigation(structure, currentId) {
    function findCtx(node) {
        if (typeof node === 'object' && node !== null) {
            if (isSubleafContainer(node)) {
                const parentId = Object.keys(node)[0];
                const children = node[parentId];
                if (children.includes(currentId)) return { parentId, children };
            } else if (!Array.isArray(node)) {
                for (const key in node) {
                    const res = findCtx(node[key]);
                    if (res) return res;
                }
            } else if (Array.isArray(node)) {
                for (const child of node) {
                    const res = findCtx(child);
                    if (res) return res;
                }
            }
        }
        return null;
    }
    const ctx = findCtx(structure);
    if (!ctx) return null;
    
    // Nếu tìm thấy mảng chứa ID hiện tại
    const { parentId, children } = ctx;
    const idx = children.indexOf(currentId);
    
    let prev = idx > 0 ? children[idx - 1] : null;
    let next = idx < children.length - 1 ? children[idx + 1] : null;
    
    // Nếu hết đường trong mảng con, thử tìm sang các Leaf lân cận trong cây lớn
    if (!prev || !next) {
        const leafList = getLeafList(structure);
        const parentIdx = leafList.indexOf(parentId);
        // Lưu ý: Logic này chỉ đúng nếu parentId cũng được coi là một leaf trong context khác, 
        // nhưng với cấu trúc hiện tại, subleaf thường tự đóng kín.
        // Giữ lại logic cũ để an toàn.
        if (parentIdx !== -1) {
            if (!prev && parentIdx > 0) prev = leafList[parentIdx - 1];
            if (!next && parentIdx < leafList.length - 1) next = leafList[parentIdx + 1];
        }
    }
    return { prev, next, type: 'subleaf' };
}

// --- FLATTEN WITH DEPTH (STRUCTURE BASED) ---
/**
 * Ép phẳng cây cấu trúc thành danh sách tuyến tính có độ sâu.
 * Quan trọng: Coi các Key của Object là node cấu trúc (dù thiếu Meta).
 */
function flattenTreeWithDepth(node, metaMap, depth = 0, list = []) {
    if (!node) return list;

    // 1. Array: Chỉ là container thứ tự, KHÔNG tăng depth
    if (Array.isArray(node)) {
        node.forEach(child => flattenTreeWithDepth(child, metaMap, depth, list));
        return list;
    }

    // 2. Object: Các Key đóng vai trò là Node trong cây
    if (typeof node === 'object') {
        Object.keys(node).forEach(key => {
            // [FIX] Luôn thêm Key vào list.
            // Nếu không có meta, gán type mặc định là 'structural'.
            // Điều này sửa lỗi cho 'dhp1-20' (có trong struct nhưng thiếu trong meta local).
            const type = (metaMap && metaMap[key]) ? metaMap[key].type : 'structural';
            
            list.push({ 
                id: key, 
                depth: depth, 
                type: type 
            });
            
            // Đệ quy xuống con (Value) -> Tăng depth lên 1
            flattenTreeWithDepth(node[key], metaMap, depth + 1, list);
        });
        return list;
    }

    // 3. String: Leaf node cuối cùng
    if (typeof node === 'string') {
        const type = (metaMap && metaMap[node]) ? metaMap[node].type : 'leaf';
        list.push({ 
            id: node, 
            depth: depth, 
            type: type 
        });
    }

    return list;
}

// --- STRICT SAME-DEPTH NAVIGATION (COUSIN LOGIC) ---
function getSameDepthNavigation(structure, currentId, metaMap) {
    const flatList = flattenTreeWithDepth(structure, metaMap);
    
    const currentIndex = flatList.findIndex(item => item.id === currentId);
    if (currentIndex === -1) return { prev: null, next: null };

    const currentItem = flatList[currentIndex];
    let prev = null;
    let next = null;

    // Tìm Next: Quét về sau
    for (let i = currentIndex + 1; i < flatList.length; i++) {
        const candidate = flatList[i];
        
        // 1. Nếu candidate sâu hơn (con cháu) -> Bỏ qua
        // Ví dụ: Đang ở dhp1-20 (Depth 1), gặp dhp1 (Depth 2) -> Bỏ qua
        if (candidate.depth > currentItem.depth) continue;

        // 2. Nếu candidate cạn hơn (cha chú) -> KHÔNG DỪNG (để tìm cousin ở nhánh khác)
        // Ví dụ: Đang ở minor (Depth 1), gặp vinaya (Depth 0) -> Bỏ qua và tiếp tục tìm pli-tv-vi
        
        // 3. Nếu candidate ngang hàng (depth bằng) -> CHÍNH LÀ NEXT -> Chọn và Dừng.
        // Ví dụ: Gặp dhp21-32 (Depth 1)
        if (candidate.depth === currentItem.depth) {
            next = candidate.id;
            break; 
        }
    }

    // Tìm Prev: Quét về trước (Logic tương tự)
    for (let i = currentIndex - 1; i >= 0; i--) {
        const candidate = flatList[i];
        
        // Với Prev, nếu gặp node cùng depth thì lấy ngay vì ta đang đi ngược lại
        if (candidate.depth === currentItem.depth) {
            prev = candidate.id;
            break;
        }
        // Nếu gặp node depth nhỏ hơn (cha), cũng không lấy, tiếp tục lùi để tìm chú bác
    }

    return { prev, next };
}

// --- MAIN EXPORT ---

export function calculateNavigation(structure, currentId, metaMap = {}) {
    // Ưu tiên 1: Check Subleaf (cho các bài kinh nhỏ nằm trong mảng)
    const subleafNav = getSubleafNavigation(structure, currentId);
    if (subleafNav) return subleafNav;

    // Ưu tiên 2: Check Branch/Group/Range (dựa vào cấu trúc cây & depth)
    // Áp dụng cho: 'dn', 'mn' (trong super), 'minor', 'dhp1-20' (trong dhp)
    const treeNav = getSameDepthNavigation(structure, currentId, metaMap);
    
    // Nếu tìm thấy đường đi theo cấu trúc cây ngang hàng
    if (treeNav.prev || treeNav.next) {
        return { ...treeNav, type: 'branch' };
    }

    // Ưu tiên 3: Fallback về Leaf List phẳng (cho bài kinh lẻ đơn giản)
    // Dành cho trường hợp ID là string leaf nhưng không nằm trong Subleaf Container đặc biệt
    const leafList = getLeafList(structure);
    const leafIdx = leafList.indexOf(currentId);
    if (leafIdx !== -1) {
        return {
            prev: leafIdx > 0 ? leafList[leafIdx - 1] : null,
            next: leafIdx < leafList.length - 1 ? leafList[leafIdx + 1] : null,
            type: 'leaf'
        };
    }

    return { prev: null, next: null };
}