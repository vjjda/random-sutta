// Path: web/assets/modules/utils/navigator_logic.js

// --- HELPERS ---

/**
 * Kiểm tra xem node có phải là container chứa Subleaf không
 * VD: { "an1.1-10": ["an1.1", "an1.2"] }
 */
function isSubleafContainer(node) {
    if (typeof node === 'object' && node !== null && !Array.isArray(node)) {
        const keys = Object.keys(node);
        // Container chỉ có 1 key duy nhất là ParentID, value là mảng Subleaf
        if (keys.length === 1 && Array.isArray(node[keys[0]])) {
            return true;
        }
    }
    return false;
}

function getIdFromNode(node) {
    if (typeof node === 'string') return node;
    if (isSubleafContainer(node)) return Object.keys(node)[0];
    return null; // Branch object phức tạp hơn
}

// --- 1. LOGIC LEAF NAVIGATION (Làm phẳng danh sách bài kinh) ---
/**
 * Tạo danh sách các "đầu mục bài kinh" (Leaves).
 * - String đơn ("mn1") -> Là Leaf.
 * - Subleaf Container ("an1.1-10") -> Lấy Key làm Leaf (đại diện cho cả nhóm).
 * - Bỏ qua nội dung bên trong Subleaf Container.
 */
function getLeafList(structure) {
    let list = [];

    function traverse(node) {
        if (typeof node === 'string') {
            list.push(node);
        } else if (Array.isArray(node)) {
            node.forEach(child => traverse(child));
        } else if (typeof node === 'object' && node !== null) {
            if (isSubleafContainer(node)) {
                // Đây là Leaf dạng gộp (Parent). Thêm ID Parent vào list.
                // Không duyệt sâu vào con (subleaves).
                list.push(Object.keys(node)[0]);
            } else {
                // Đây là Branch (Vagga/Nipata). Duyệt tiếp vào con để tìm Leaf.
                Object.values(node).forEach(child => traverse(child));
            }
        }
    }

    traverse(structure);
    return list;
}

// --- 2. LOGIC BRANCH NAVIGATION (Cùng cấp độ) ---
function getBranchSiblings(structure, branchId) {
    // Tìm object cha chứa key == branchId
    function findParentContainer(node) {
        if (typeof node === 'object' && node !== null) {
            // Nếu node này chứa branchId như một key trực tiếp
            if (Object.prototype.hasOwnProperty.call(node, branchId)) {
                return Object.keys(node); // Trả về danh sách anh em (keys)
            }
            
            // Nếu không, duyệt tiếp con
            for (const key in node) {
                // Bỏ qua nếu con là array (leaf list) hoặc subleaf container
                if (Array.isArray(node[key]) || isSubleafContainer(node[key])) continue;
                
                const res = findParentContainer(node[key]);
                if (res) return res;
            }
        }
        return null;
    }

    const siblings = findParentContainer(structure);
    if (!siblings) return { prev: null, next: null };

    const idx = siblings.indexOf(branchId);
    return {
        prev: idx > 0 ? siblings[idx - 1] : null,
        next: idx < siblings.length - 1 ? siblings[idx + 1] : null
    };
}

// --- 3. LOGIC SUBLEAF CONTEXT ---
function findSubleafContext(structure, subleafId) {
    // Tìm Parent Container chứa subleafId
    function traverse(node) {
        if (typeof node === 'object' && node !== null) {
            if (isSubleafContainer(node)) {
                const parentId = Object.keys(node)[0];
                const children = node[parentId];
                if (children.includes(subleafId)) {
                    return { parentId, children };
                }
            } else if (!Array.isArray(node)) {
                // Branch -> Duyệt sâu
                for (const key in node) {
                    const res = traverse(node[key]);
                    if (res) return res;
                }
            } else if (Array.isArray(node)) {
                // Array -> Duyệt phần tử
                for (const child of node) {
                    const res = traverse(child);
                    if (res) return res;
                }
            }
        }
        return null;
    }
    return traverse(structure);
}

// --- MAIN EXPORT ---

export function calculateNavigation(structure, currentId) {
    // A. Xử lý SUBLEAF
    const subCtx = findSubleafContext(structure, currentId);
    if (subCtx) {
        const { parentId, children } = subCtx;
        const idx = children.indexOf(currentId);
        
        let prev = idx > 0 ? children[idx - 1] : null;
        let next = idx < children.length - 1 ? children[idx + 1] : null;

        // Escalation: Nếu hết đường nội bộ -> Nhảy sang đường của Parent
        if (!prev || !next) {
            const leafList = getLeafList(structure);
            const parentIdx = leafList.indexOf(parentId);
            
            if (parentIdx !== -1) {
                // Logic đặc thù:
                // Prev của con cả = Prev Sibling của Bố
                if (!prev && parentIdx > 0) prev = leafList[parentIdx - 1];
                
                // Next của con út = Next Sibling của Bố
                if (!next && parentIdx < leafList.length - 1) next = leafList[parentIdx + 1];
            }
        }
        return { prev, next, type: 'subleaf' };
    }

    // B. Xử lý LEAF (Bài kinh thường hoặc Parent Range)
    const leafList = getLeafList(structure);
    const leafIdx = leafList.indexOf(currentId);
    if (leafIdx !== -1) {
        return {
            prev: leafIdx > 0 ? leafList[leafIdx - 1] : null,
            next: leafIdx < leafList.length - 1 ? leafList[leafIdx + 1] : null,
            type: 'leaf'
        };
    }

    // C. Xử lý BRANCH
    // Nếu không phải Leaf/Subleaf -> Coi là Branch
    return getBranchNavigation(structure, currentId);
}

function getBranchNavigation(structure, currentId) {
    const nav = getBranchSiblings(structure, currentId);
    return { ...nav, type: 'branch' };
}