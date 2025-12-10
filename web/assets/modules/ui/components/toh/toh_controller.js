// Path: web/assets/modules/ui/components/toh/toh_controller.js
import { ContentScanner } from './content_scanner.js';
import { DomRenderer } from './dom_renderer.js';

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
    
    // Click outside to close
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

        // 1. Scan Data (Sử dụng ContentScanner)
        const scanResult = ContentScanner.scan(els.container);

        // 2. Render & Display (Sử dụng DomRenderer)
        if (scanResult.mode === 'none') {
            els.wrapper.classList.add("hidden");
            els.menu.classList.remove("toh-mode-paragraphs"); // Ensure class is removed if no items
        } else {
            DomRenderer.updateHeader(scanResult.mode, els.header);
            DomRenderer.renderList(scanResult.items, els.list, {
                onItemClick: closeMenu
            });
            els.wrapper.classList.remove("hidden");
            
            // [NEW] Add mode class to menu for styling
            if (scanResult.mode === 'paragraphs') {
                els.menu.classList.add("toh-mode-paragraphs");
            } else {
                els.menu.classList.remove("toh-mode-paragraphs");
            }
        }
    }

    return { generate };
}