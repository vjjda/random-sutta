// Path: web/assets/modules/utils/navigator_logic.js

// --- HELPERS GIỮ NGUYÊN ---
function isSubleafContainer(node) {
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
        const keys = Object.keys(node);
        if (keys.length === 1 && Array.isArray(node[keys[0]])) {
            return true;
        }
    }
    return false;
}

function getLeafList(structure) {
    let list = [];
    function traverse(node) {
        if (typeof node === 'string') {
            list.push(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => traverse(child));
        } else if (typeof node === 'object' && node !== null) {
            if (isSubleafContainer(node)) {
                list.push(Object.keys(node)[0]);
            } else {
                Object.values(node).forEach(child => traverse(child));
            }
        }
    }
    traverse(structure);
    return list;
}

// --- LOGIC SUBLEAF GIỮ NGUYÊN ---
function getSubleafNavigation(structure, currentId) {
    // ... (Giữ nguyên code subleaf đã đúng) ...
    // Copy-paste lại đoạn code getSubleafNavigation từ phiên bản trước
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
    const { parentId, children } = ctx;
    const idx = children.indexOf(currentId);
    let prev = idx > 0 ? children[idx - 1] : null;
    let next = idx < children.length - 1 ? children[idx + 1] : null;
    if (!prev || !next) {
        const leafList = getLeafList(structure);
        const parentIdx = leafList.indexOf(parentId);
        if (parentIdx !== -1) {
            if (!prev && parentIdx > 0) prev = leafList[parentIdx - 1];
            if (!next && parentIdx < leafList.length - 1) next = leafList[parentIdx + 1];
        }
    }
    return { prev, next, type: 'subleaf' };
}

// --- FIX LOGIC BRANCH (Deep Search) ---
function getBranchSiblings(structure, branchId) {
    console.log(`[NavLogic] searching branch siblings for: ${branchId}`);
    let siblings = null;

    function traverse(node, depth = 0) {
        if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
            
            // 1. Check trực tiếp keys của node hiện tại
            if (Object.prototype.hasOwnProperty.call(node, branchId)) {
                console.log(`[NavLogic] Found container at depth ${depth}. Keys:`, Object.keys(node));
                // Lấy tất cả keys làm siblings (trừ meta/isBranch)
                siblings = Object.keys(node).filter(k => k !== 'meta' && k !== 'isBranch');
                return true; 
            }

            // 2. Đệ quy xuống con
            for (const key in node) {
                // Bỏ qua meta để tránh nhiễu
                if (key === 'meta' || key === 'isBranch') continue;

                const child = node[key];
                
                // Chỉ đi tiếp vào Object (không phải Array Leaf, không phải Subleaf)
                // Tuy nhiên, Super Struct có thể chứa Array các strings (như "dn", "mn" nếu cấu trúc là list)
                // Nhưng trong file mẫu bạn gửi, cấu trúc là Map { "long": [...], "middle": [...] }
                // Nên ta tập trung vào Object traversal.
                
                if (typeof child === 'object' && child !== null && !Array.isArray(child) && !isSubleafContainer(child)) {
                    if (traverse(child, depth + 1)) return true;
                }
            }
        }
        return false;
    }

    traverse(structure);

    if (!siblings) {
        console.warn(`[NavLogic] No container found for branch: ${branchId}`);
        return { prev: null, next: null };
    }

    const idx = siblings.indexOf(branchId);
    // console.log(`[NavLogic] Index of ${branchId} is ${idx}`);
    
    return {
        prev: idx > 0 ? siblings[idx - 1] : null,
        next: idx < siblings.length - 1 ? siblings[idx + 1] : null
    };
}


// --- MAIN EXPORT ---

export function calculateNavigation(structure, currentId) {
    // 1. Subleaf
    const subleafNav = getSubleafNavigation(structure, currentId);
    if (subleafNav) return subleafNav;

    // 2. Leaf (Reading Mode) - Chỉ check trong Leaf List
    const leafList = getLeafList(structure);
    const leafIdx = leafList.indexOf(currentId);
    if (leafIdx !== -1) {
        return {
            prev: leafIdx > 0 ? leafList[leafIdx - 1] : null,
            next: leafIdx < leafList.length - 1 ? leafList[leafIdx + 1] : null,
            type: 'leaf'
        };
    }

    // 3. Branch (Browsing Mode) - Chỉ tìm trong Branch Tree
    const branchNav = getBranchSiblings(structure, currentId);
    return { ...branchNav, type: 'branch' };
}