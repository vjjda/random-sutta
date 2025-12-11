// Path: web/assets/modules/ui/components/magic_nav/breadcrumb_renderer.js
export const BreadcrumbRenderer = {
    findPath(structure, targetUid, currentPath = []) {
        if (!structure) return null;
        if (typeof structure === 'string') {
            return structure === targetUid ? [...currentPath, structure] : null;
        }
        if (Array.isArray(structure)) {
            for (const child of structure) {
                const result = this.findPath(child, targetUid, currentPath);
                if (result) return result;
            }
            return null;
        }
        if (typeof structure === 'object' && structure !== null) {
            for (const key in structure) {
                const newPath = [...currentPath, key];
                if (key === targetUid) return newPath;
                const result = this.findPath(structure[key], targetUid, newPath);
                if (result) return result;
            }
        }
        return null;
    },

    // Helper: Kiểm tra xem UID này có phải là Single Parent trong cây không
    _isSingleChain(uid, structure) {
        if (!structure) return false;
        
        // Tìm node trong tree tương ứng với uid
        const findNode = (node, targetId) => {
            if (typeof node === 'string') return node === targetId ? 'LEAF' : null;
            if (Array.isArray(node)) {
                for (const child of node) {
                    const res = findNode(child, targetId);
                    if (res) return res;
                }
                return null;
            }
            if (typeof node === 'object') {
                if (node[targetId]) return node[targetId]; // Found it
                for (const key in node) {
                    const res = findNode(node[key], targetId);
                    if (res) return res;
                }
            }
            return null;
        };

        const nodeContent = findNode(structure, uid);
        
        // Logic: Nó là single chain nếu node đó là Array có đúng 1 phần tử
        if (Array.isArray(nodeContent) && nodeContent.length === 1) {
            const child = nodeContent[0];
            if (typeof child === 'string') return child;
            if (typeof child === 'object') {
                const keys = Object.keys(child);
                if (keys.length === 1) return keys[0];
            }
        }
        return false;
    },

    generateHtml(path, metaMap, localRootId = null, fullTree = null) {
        let html = `<ol>`;
        
        for (let i = 0; i < path.length; i++) {
            const uid = path[i];
            
            let labelParts = [];
            let currentId = uid;
            let targetId = uid; 
            
            const getLabel = (id) => {
                const m = metaMap[id] || {};
                return m.acronym || m.original_title || id.toUpperCase();
            };
            
            labelParts.push(getLabel(currentId));

            // Vòng lặp look-ahead để gộp node
            while (i + 1 < path.length) {
                const nextId = path[i+1];
                const singleChildId = this._isSingleChain(currentId, fullTree);
                
                if (singleChildId === nextId) {
                    labelParts.push(getLabel(nextId));
                    currentId = nextId;
                    targetId = nextId;
                    i++; 
                } else {
                    break; 
                }
            }

            const isLast = i === path.length - 1;
            const isRoot = (i === 0 && labelParts.length === 1) || uid === localRootId;
            const markerClass = isRoot ? " bc-root-marker" : "";
            
            // [CHANGED] Dùng dấu gạch ngang (-) thay vì dấu gạch chéo
            const finalLabel = labelParts.join('<span class="bc-sep-mini">-</span>');

            if (html !== `<ol>`) html += `<li class="bc-sep">/</li>`; 

            if (isLast) {
                html += `<li class="bc-item active${markerClass}">${finalLabel}</li>`;
            } else {
                html += `<li><button onclick="window.loadSutta('${targetId}'); MagicNav.closeAll()" class="bc-link${markerClass}">${finalLabel}</button></li>`;
            }
        }

        html += `<li id="magic-bc-end"></li>`;
        html += `</ol>`;
        return html;
    }
};