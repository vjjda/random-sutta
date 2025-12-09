// Path: web/assets/modules/ui/views/renderer.js
import { LeafRenderer } from "./renderers/leaf_renderer.js";
import { BranchRenderer } from "./renderers/branch_renderer.js";
import { setupTableOfHeadings } from "../components/toh.js";
import { UIFactory } from "../common/ui_factory.js";
import { HeaderView } from "./header_view.js";
import { Breadcrumb } from "../components/breadcrumb.js"; // [NEW]

let tohInstance = null;

export async function renderSutta(suttaId, data, options = {}) {
    const container = document.getElementById("sutta-container");
    if (!data) {
        container.innerHTML = UIFactory.createErrorHtml(suttaId);
        // Ẩn breadcrumb khi lỗi
        document.getElementById("breadcrumb-container")?.classList.add("hidden");
        return false;
    }

    container.innerHTML = "";
    let renderResult = null;
    let isLeaf = false;

    if (data.content) {
        renderResult = LeafRenderer.render(data);
        isLeaf = true;
    } else {
        renderResult = BranchRenderer.render(data);
        document.getElementById("toh-wrapper")?.classList.add("hidden");
    }

    const nav = data.nav || {};
    const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.navMeta || {});
    
    container.innerHTML = renderResult.html + bottomNavHtml;

    HeaderView.update(renderResult.displayInfo, nav.prev, nav.next, data.navMeta);

    // [NEW] Render Breadcrumb
    // Gom tất cả meta lại để tra cứu tên hiển thị
    const combinedMeta = { ...data.contextMeta, ...data.navMeta };
    if (data.meta) combinedMeta[data.uid] = data.meta;

    Breadcrumb.render(
        "breadcrumb-container", 
        data.tree, // Structure tree lấy từ Service
        data.uid, 
        combinedMeta
    );

    if (isLeaf) {
        if (!tohInstance) tohInstance = setupTableOfHeadings();
        tohInstance.generate();
    }

    return true;
}