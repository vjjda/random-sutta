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

    generateHtml(path, metaMap, localRootId = null) {
        let html = `<ol>`;
        path.forEach((uid, index) => {
            const isLast = index === path.length - 1;
            const meta = metaMap[uid] || {};
            let label = meta.acronym || meta.original_title || uid.toUpperCase();
            
            // Highlight Root (TPK/Super) and Local Root (Book Hint)
            const isRoot = index === 0 || uid === localRootId;
            const markerClass = isRoot ? " bc-root-marker" : "";

            if (index > 0) html += `<li class="bc-sep">/</li>`;
            
            if (isLast) {
                // Active item implies current location, usually not a root marker unless it's the root itself
                html += `<li class="bc-item active${markerClass}">${label}</li>`;
            } else {
                html += `<li><button onclick="window.loadSutta('${uid}')" class="bc-link${markerClass}">${label}</button></li>`;
            }
        });
        
        // [NEW] Thêm phần tử Spacer Marker vào cuối danh sách
        html += `<li id="magic-bc-end"></li>`;
        
        html += `</ol>`;
        return html;
    }
};