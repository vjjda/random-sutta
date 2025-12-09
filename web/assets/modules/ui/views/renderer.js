// Path: web/assets/modules/ui/views/renderer.js
import { LeafRenderer } from "./renderers/leaf_renderer.js";
import { BranchRenderer } from "./renderers/branch_renderer.js";
import { setupTableOfHeadings } from "../components/toh.js";
import { UIFactory } from "../common/ui_factory.js";
import { HeaderView } from "./header_view.js"; // [NEW]

let tohInstance = null;

export async function renderSutta(suttaId, data, options = {}) {
    const container = document.getElementById("sutta-container");
    if (!data) {
        container.innerHTML = UIFactory.createErrorHtml(suttaId);
        return false;
    }

    container.innerHTML = "";
    let renderResult = null;
    let isLeaf = false;

    // 1. Dispatch Renderer
    if (data.content) {
        renderResult = LeafRenderer.render(data);
        isLeaf = true;
    } else {
        renderResult = BranchRenderer.render(data);
        document.getElementById("toh-wrapper")?.classList.add("hidden");
    }

    // 2. Render Main HTML + Bottom Nav
    const nav = data.nav || {};
    const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.navMeta || {});
    
    container.innerHTML = renderResult.html + bottomNavHtml;

    // 3. Delegate Header Update to HeaderView
    HeaderView.update(renderResult.displayInfo, nav.prev, nav.next, data.navMeta);

    // 4. Setup Table of Headings (if leaf)
    if (isLeaf) {
        if (!tohInstance) tohInstance = setupTableOfHeadings();
        tohInstance.generate();
    }

    return true;
}