// Path: web/assets/modules/utils/navigator_logic.js

/**
 * Duyệt cây và tạo danh sách tuyến tính chứa thông tin độ sâu.
 * @param {Object|Array} node - Nút hiện tại
 * @param {Object} metaMap - Bản đồ metadata để tra cứu type
 * @param {number} depth - Độ sâu hiện tại
 * @param {Array} list - Danh sách kết quả tích lũy
 */
function flattenTreeWithDepth(node, metaMap, depth = 0, list = []) {
    if (!node) return list;

    // 1. Xử lý Array: Duyệt tuần tự, không tăng depth vì Array chỉ là wrapper thứ tự trong JSON
    if (Array.isArray(node)) {
        node.forEach(child => flattenTreeWithDepth(child, metaMap, depth, list));
        return list;
    }

    // 2. Xử lý Object (Container)
    if (typeof node === 'object') {
        Object.keys(node).forEach(key => {
            // Check nếu Key là một entity có trong Meta (ví dụ "kn", "dn")
            if (metaMap && metaMap[key]) {
                list.push({ 
                    id: key, 
                    depth: depth, 
                    type: metaMap[key].type 
                });
            }
            
            // Đệ quy xuống con (Value), tăng depth
            // Lưu ý: Nếu value là Array (vd: "kn": [...]), depth tăng 1 là hợp lý cho các phần tử con
            flattenTreeWithDepth(node[key], metaMap, depth + 1, list);
        });
        return list;
    }

    // 3. Xử lý String (Leaf node trong JSON, vd "dn1")
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

function getSameDepthNavigation(structure, currentId, metaMap) {
    // 1. Ép phẳng cây kèm độ sâu
    const flatList = flattenTreeWithDepth(structure, metaMap);
    
    // 2. Tìm vị trí hiện tại
    const currentIndex = flatList.findIndex(item => item.id === currentId);
    if (currentIndex === -1) return { prev: null, next: null };

    const currentItem = flatList[currentIndex];
    let prev = null;
    let next = null;

    // 3. Tìm Next: Quét về phía sau, bỏ qua các node sâu hơn (con cháu)
    for (let i = currentIndex + 1; i < flatList.length; i++) {
        const candidate = flatList[i];
        
        // Nếu gặp node cạn hơn hoặc bằng (depth <= current), đó là sibling hoặc uncle
        // Điều này đảm bảo ta nhảy từ 'an' (depth 3) sang 'kn' (depth 3), bỏ qua con của 'an' nếu có
        if (candidate.depth <= currentItem.depth) {
            next = candidate.id;
            break; 
        }
        // Nếu candidate.depth > currentItem.depth -> Nó là con cháu, tiếp tục bỏ qua
    }

    // 4. Tìm Prev: Quét về phía trước
    for (let i = currentIndex - 1; i >= 0; i--) {
        const candidate = flatList[i];
        if (candidate.depth <= currentItem.depth) {
            prev = candidate.id;
            break;
        }
    }

    return { prev, next };
}

// --- MAIN EXPORT ---

export function calculateNavigation(structure, currentId, metaMap = {}) {
    const currentMeta = metaMap[currentId];
    const isBranch = currentMeta && (currentMeta.type === 'branch' || currentMeta.type === 'root');

    // [NEW STRATEGY]
    // Nếu là Branch (như 'dn', 'mn', 'kn'), dùng logic Same-Depth Strict
    if (isBranch) {
        const nav = getSameDepthNavigation(structure, currentId, metaMap);
        return { ...nav, type: 'branch' };
    }

    // Nếu là Leaf/Subleaf, dùng logic cũ (Deep Search flatten)
    // Logic cũ cần được giữ nguyên cho các bài kinh cụ thể (dn1, dn2...)
    
    // --- (Code cũ cho Subleaf/Leaf) ---
    
    // Helper cũ tái sử dụng cục bộ
    function isSubleafContainer(node) {
        if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
            const keys = Object.keys(node);
            return keys.length === 1 && Array.isArray(node[keys[0]]);
        }
        return false;
    }

    function getSubleafNav(struct, cid) {
        // ... (Logic subleaf cũ giữ nguyên) ...
        function findCtx(node) {
            if (typeof node === 'object' && node !== null) {
                if (isSubleafContainer(node)) {
                    const parentId = Object.keys(node)[0];
                    if (node[parentId].includes(cid)) return { parentId, children: node[parentId] };
                } else if (!Array.isArray(node)) {
                    for (const key in node) { const r = findCtx(node[key]); if(r) return r; }
                } else if (Array.isArray(node)) {
                    for (const c of node) { const r = findCtx(c); if(r) return r; }
                }
            }
            return null;
        }
        const ctx = findCtx(struct);
        if(!ctx) return null;
        const idx = ctx.children.indexOf(cid);
        return { 
            prev: idx > 0 ? ctx.children[idx-1] : null, 
            next: idx < ctx.children.length-1 ? ctx.children[idx+1] : null,
            type: 'subleaf'
        };
    }

    const subleaf = getSubleafNav(structure, currentId);
    if (subleaf) {
        // Nếu subleaf hết đường, fallback ra cha (để tìm sang bài kinh kế tiếp)
        // Tuy nhiên, logic hiện tại của bạn có vẻ muốn giữ subleaf trong phạm vi cha.
        // Nếu muốn prev/next xuyên bài, cần logic phức tạp hơn. Tạm thời giữ nguyên.
        return subleaf;
    }

    // Leaf Logic: Flatten string only
    // Cẩn thận: getSameDepthNavigation cũng có thể dùng cho leaf nếu leaf cùng depth
    // Nhưng để an toàn và tương thích cũ, ta dùng simple flatten cho leaf strings
    const leafList = [];
    function traverse(node) {
        if (typeof node === 'string') leafList.push(node);
        else if (Array.isArray(node)) node.forEach(traverse);
        else if (typeof node === 'object' && node !== null) Object.values(node).forEach(traverse);
    }
    traverse(structure);
    
    const idx = leafList.indexOf(currentId);
    if (idx !== -1) {
        return {
            prev: idx > 0 ? leafList[idx-1] : null,
            next: idx < leafList.length-1 ? leafList[idx+1] : null,
            type: 'leaf'
        };
    }

    return { prev: null, next: null };
}