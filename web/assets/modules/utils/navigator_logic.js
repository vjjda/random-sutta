// Path: web/assets/modules/utils/navigator_logic.js

// --- HELPERS ---
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

// --- LOGIC SUBLEAF ---
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

// --- LOGIC BRANCH (FIXED: ARRAY AWARE) ---
function getBranchSiblings(structure, branchId) {
    // Helper: Tìm danh sách anh em chứa branchId
    function findSiblingGroup(node) {
        if (!node) return null;

        // Trường hợp 1: Node là Mảng (Array)
        // Cấu trúc Super Tree thường dùng mảng để giữ thứ tự: [{long:...}, {middle:...}]
        if (Array.isArray(node)) {
            // Bước A: Gom nhóm "Virtual Siblings" ở cấp độ mảng này
            let virtualKeys = [];
            for (const item of node) {
                if (typeof item === 'string') {
                    virtualKeys.push(item);
                } else if (typeof item === 'object' && item !== null) {
                    // Lấy key của object con (ví dụ 'long' từ {long: [...]})
                    // Loại bỏ các key meta/isBranch để không nhiễu
                    const keys = Object.keys(item).filter(k => k !== 'meta' && k !== 'isBranch');
                    virtualKeys.push(...keys);
                }
            }

            // Bước B: Kiểm tra xem branchId cần tìm có nằm trong danh sách ảo này không
            if (virtualKeys.includes(branchId)) {
                return virtualKeys;
            }

            // Bước C: Nếu không tìm thấy, đệ quy xuống từng phần tử con
            for (const item of node) {
                // Nếu item là object (container), đi sâu vào giá trị của nó
                if (typeof item === 'object' && item !== null) {
                    // Vì item thường là dạng { "long": [...] }, ta phải dive vào values
                    for (const val of Object.values(item)) {
                        const res = findSiblingGroup(val);
                        if (res) return res;
                    }
                }
            }
        }
        
        // Trường hợp 2: Node là Object thông thường
        // Cấu trúc Local Tree thường dùng object: { dn1: ..., dn2: ... }
        else if (typeof node === 'object') {
            // Bước A: Kiểm tra keys trực tiếp
            const keys = Object.keys(node).filter(k => k !== 'meta' && k !== 'isBranch');
            if (keys.includes(branchId)) {
                return keys;
            }

            // Bước B: Đệ quy xuống các values
            for (const key of keys) {
                const res = findSiblingGroup(node[key]);
                if (res) return res;
            }
        }

        return null;
    }

    const siblings = findSiblingGroup(structure);

    if (!siblings) {
        console.warn(`[NavLogic] No container found for branch: ${branchId}`);
        return { prev: null, next: null };
    }

    const idx = siblings.indexOf(branchId);
    
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

    // 3. Branch (Browsing Mode) - [FIXED] Dùng logic mới hỗ trợ Array
    const branchNav = getBranchSiblings(structure, currentId);
    return { ...branchNav, type: 'branch' };
}