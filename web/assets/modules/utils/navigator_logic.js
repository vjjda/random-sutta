// Path: web/assets/modules/utils/navigator_logic.js

// --- 1. HELPERS ---

function isSubleafContainer(node) {
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
        const keys = Object.keys(node);
        if (keys.length === 1 && Array.isArray(node[keys[0]])) {
            return true;
        }
    }
    return false;
}

// --- 2. LOGIC LEAF/SUBLEAF (Linear Flattening) ---
// Giữ nguyên logic làm phẳng danh sách để đọc tuần tự (Reading Mode)
function getLeafList(structure) {
    let list = [];

    function traverse(node) {
        if (typeof node === 'string') {
            list.push(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => traverse(child));
        } else if (typeof node === 'object' && node !== null) {
            if (isSubleafContainer(node)) {
                // Parent Leaf (VD: an1.1-10) -> Thêm vào list
                list.push(Object.keys(node)[0]);
            } else {
                // Branch -> Duyệt sâu vào con để tìm Leaf
                Object.values(node).forEach(child => traverse(child));
            }
        }
    }

    traverse(structure);
    return list;
}

// --- 3. LOGIC BRANCH (Strict Sibling) ---
// Tìm cha của branchId và trả về anh em liền kề (Browsing Mode)
function getBranchSiblings(structure, branchId) {
    let siblings = null;

    // Hàm duyệt cây tìm container chứa key == branchId
    function traverse(node) {
        if (typeof node === 'object' && node !== null) {
            // Kiểm tra xem node này có chứa branchId làm key trực tiếp không
            if (Object.prototype.hasOwnProperty.call(node, branchId)) {
                siblings = Object.keys(node);
                return true; // Stop traversing
            }

            // Nếu không, duyệt tiếp con
            for (const key in node) {
                // Bỏ qua nếu là Leaf Array hoặc Subleaf Container
                if (Array.isArray(node[key]) || isSubleafContainer(node[key])) continue;
                
                if (traverse(node[key])) return true;
            }
        }
        return false;
    }

    traverse(structure);

    if (!siblings) return { prev: null, next: null };

    const idx = siblings.indexOf(branchId);
    return {
        prev: idx > 0 ? siblings[idx - 1] : null,
        next: idx < siblings.length - 1 ? siblings[idx + 1] : null
    };
}

// --- 4. LOGIC SUBLEAF SPECIFIC ---
function getSubleafNavigation(structure, currentId) {
    // Tìm context của subleaf
    function findCtx(node) {
        if (typeof node === 'object' && node !== null) {
            if (isSubleafContainer(node)) {
                const parentId = Object.keys(node)[0];
                const children = node[parentId];
                if (children.includes(currentId)) {
                    return { parentId, children };
                }
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

    // Escalation: Nhảy ra Parent Sibling
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


// --- MAIN EXPORT ---

export function calculateNavigation(structure, currentId) {
    // 1. Ưu tiên kiểm tra Subleaf (logic phức tạp nhất)
    const subleafNav = getSubleafNavigation(structure, currentId);
    if (subleafNav) return subleafNav;

    // 2. Kiểm tra Leaf (trong danh sách phẳng)
    // Lưu ý: Subleaf cũng có thể xuất hiện trong getLeafList (nếu logic getLeafList đổi),
    // nhưng ở đây ta đã handle subleaf ở bước 1 rồi.
    // Bước này dành cho Leaf thường (mn1) và Parent Leaf (an1.1-10)
    const leafList = getLeafList(structure);
    const leafIdx = leafList.indexOf(currentId);

    if (leafIdx !== -1) {
        return {
            prev: leafIdx > 0 ? leafList[leafIdx - 1] : null,
            next: leafIdx < leafList.length - 1 ? leafList[leafIdx + 1] : null,
            type: 'leaf'
        };
    }

    // 3. Cuối cùng là Branch (Browsing)
    // Chỉ tìm Sibling trong cùng container, KHÔNG leo thang.
    const branchNav = getBranchSiblings(structure, currentId);
    return { ...branchNav, type: 'branch' };
}