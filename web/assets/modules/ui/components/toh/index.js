// Path: web/assets/modules/ui/components/toh/index.js
import { TohScanner } from './toh_scanner.js';
import { TohRenderer } from './toh_renderer.js';

export function setupTableOfHeadings() {
    const els = {
        wrapper: document.getElementById("toh-wrapper"),
        fab: document.getElementById("toh-fab"),
        menu: document.getElementById("toh-menu"),
        list: document.getElementById("toh-list"),
        container: document.getElementById("sutta-container"),
        header: document.querySelector("#toh-menu .toh-header")
    };

    if (!els.wrapper || !els.fab || !els.menu || !els.list || !els.container) {
        return { generate: () => {} };
    }

    // --- Event Handlers ---
    const closeMenu = () => {
        els.menu.classList.add("hidden");
        els.fab.classList.remove("active");
    };

    const toggleMenu = (e) => {
        els.menu.classList.toggle("hidden");
        els.fab.classList.toggle("active");
        e.stopPropagation();
    };

    // Binding Events
    els.fab.onclick = toggleMenu;
    
    document.addEventListener("click", (e) => {
        if (!els.menu.classList.contains("hidden") && !els.wrapper.contains(e.target)) {
            closeMenu();
        }
    });

    // --- Main Logic ---
    function generate() {
        // Reset State
        els.list.innerHTML = "";
        closeMenu();

        // 1. Scan Data
        const scanResult = TohScanner.scan(els.container);

        // 2. Render & Display
        if (scanResult.mode === 'none') {
            els.wrapper.classList.add("hidden");
        } else {
            TohRenderer.updateHeader(scanResult.mode, els.header);
            TohRenderer.renderList(scanResult.items, els.list, {
                onItemClick: closeMenu
            });
            els.wrapper.classList.remove("hidden");
        }
    }

    return { generate };
}