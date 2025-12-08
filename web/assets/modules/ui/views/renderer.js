// Path: web/assets/modules/ui/views/renderer.js
import { LeafRenderer } from "./renderers/leaf_renderer.js";
import { BranchRenderer } from "./renderers/branch_renderer.js";
import { setupTableOfHeadings } from "../components/toh.js";
import { UIFactory } from "../common/ui_factory.js";

let tohInstance = null;

function updateTopNavDOM(displayInfo, prevId, nextId, navMeta) {
    const navHeader = document.getElementById("nav-header");
    const navMainTitle = document.getElementById("nav-main-title");
    const navSubTitle = document.getElementById("nav-sub-title");
    
    if (navMainTitle) navMainTitle.textContent = displayInfo.main;
    if (navSubTitle) navSubTitle.textContent = displayInfo.sub;

    document.getElementById("nav-title-text")?.classList.remove("hidden");
    document.getElementById("nav-search-container")?.classList.add("hidden");

    // Setup Buttons (Logic giống cũ)
    const setupBtn = (btnId, targetId, type) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (targetId) {
            btn.disabled = false;
            btn.onclick = () => window.loadSutta(targetId);
            // Tooltip logic
            // ... (Copy logic tooltip cũ)
        } else {
            btn.disabled = true;
            btn.onclick = null;
        }
    };
    setupBtn("nav-prev", prevId, "Previous");
    setupBtn("nav-next", nextId, "Next");

    navHeader?.classList.remove("hidden");
    document.getElementById("status")?.classList.add("hidden");
}

export async function renderSutta(suttaId, data, options = {}) {
    const container = document.getElementById("sutta-container");
    if (!data) {
        container.innerHTML = UIFactory.createErrorHtml(suttaId);
        return false;
    }

    container.innerHTML = "";
    let renderResult = null;
    let isLeaf = false;

    // Dispatch
    if (data.content) {
        renderResult = LeafRenderer.render(data);
        isLeaf = true;
    } else {
        renderResult = BranchRenderer.render(data);
        document.getElementById("toh-wrapper")?.classList.add("hidden");
    }

    // Render HTML
    const nav = data.nav || {};
    const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next, data.navMeta || {});
    
    container.innerHTML = renderResult.html + bottomNavHtml;
    
    // Update UI
    updateTopNavDOM(renderResult.displayInfo, nav.prev, nav.next, data.navMeta);

    if (isLeaf) {
        if (!tohInstance) tohInstance = setupTableOfHeadings();
        tohInstance.generate();
    }

    return true;
}