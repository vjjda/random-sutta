/* Path: web/assets/modules/ui/views/renderer.js */
import { LeafRenderer } from "./renderers/leaf_renderer.js";
import { BranchRenderer } from "./renderers/branch_renderer.js";
import { setupTableOfHeadings } from "../components/toh/toh_controller.js";
import { UIFactory } from "../common/ui_factory.js";
import { HeaderView } from "./header_view.js";
import { MagicNav } from "../components/magic_nav/magic_nav_controller.js";

let tohInstance = null;

export async function renderSutta(suttaId, data, options = {}) {
    const container = document.getElementById("sutta-container");
    
    // 1. Kiểm tra data null (giữ nguyên)
    if (!data) {
        container.innerHTML = UIFactory.createErrorHtml(suttaId);
        document.getElementById("breadcrumb-container")?.classList.add("hidden");
        return false;
    }

    container.innerHTML = "";
    let renderResult = null;
    let isLeaf = false;

    // [FIX LOGIC] Phân loại dựa trên Meta Type thay vì chỉ dựa vào sự tồn tại của Content
    // Nếu có content -> Chắc chắn render Leaf
    if (data.content) {
        renderResult = LeafRenderer.render(data);
        isLeaf = true;
    } 
    // Nếu Meta nói là 'branch' hoặc 'super_book' -> Render Branch
    else if (data.meta && (data.meta.type === 'branch' || data.meta.type === 'super_book' || data.meta.type === 'root')) {
        renderResult = BranchRenderer.render(data);
        document.getElementById("toh-wrapper")?.classList.add("hidden");
    } 
    // [NEW] Trường hợp còn lại: Meta là Leaf nhưng Content = null (Lỗi tải)
    else {
        console.error(`Render Error: Content missing for Leaf node '${suttaId}'`);
        container.innerHTML = `
            <div class="error-message">
                <p style="color: #d35400; font-weight: bold;">Content Unavailable (Offline)</p>
                <p>Unable to load content for <b>${suttaId.toUpperCase()}</b>.</p>
                <p>Please check your connection or try resetting the cache.</p>
            </div>`;
        return false;
    }

    // ... (Phần còn lại giữ nguyên)
    if (!window._magicNavInitialized) {
        MagicNav.init();
        window._magicNavInitialized = true;
    }

    const nav = data.nav || {};
    const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.navMeta || {});
    
    container.innerHTML = renderResult.html + bottomNavHtml;

    HeaderView.update(renderResult.displayInfo, nav.prev, nav.next, data.navMeta);

    const combinedMeta = { ...data.contextMeta, ...data.navMeta };
    if (data.meta) combinedMeta[data.uid] = data.meta;

    MagicNav.render(
        data.tree, 
        data.uid, 
        combinedMeta,
        data.superTree, 
        data.superMeta
    );

    if (isLeaf) {
        // [UPDATED] Gọi controller mới
        if (!tohInstance) tohInstance = setupTableOfHeadings();
        tohInstance.generate();
    }

    return true;
}