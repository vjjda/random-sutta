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
        const isOpening = els.menu.classList.contains("hidden");
        els.menu.classList.toggle("hidden");
        els.fab.classList.toggle("active");
        e.stopPropagation();

        if (isOpening) {
            // Force scroll to active item when opening
            // Use setTimeout to ensure layout is updated after removing 'hidden'
            setTimeout(() => {
                const activeItem = els.list.querySelector(".active");
                if (activeItem) {
                    activeItem.scrollIntoView({ block: "center", behavior: "instant" });
                }
            }, 0);
        }
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
    let observer = null;

    function generate() {
        // Reset State
        els.list.innerHTML = "";
        closeMenu();
        if (observer) observer.disconnect();

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

            // [NEW] Active State Tracking
            const idsToTrack = [];
            scanResult.items.forEach(item => {
                if (item.id) idsToTrack.push(item.id);
                if (item.subTexts) {
                    item.subTexts.forEach(sub => {
                        if (sub.id) idsToTrack.push(sub.id);
                    });
                }
            });

            if (idsToTrack.length > 0) {
                observer = new IntersectionObserver((entries) => {
                    // Logic: Find the first entry that is intersecting.
                    // Ideally, we want the one closest to the top of viewport.
                    // But intersection observer triggers when they enter/leave.
                    // Simple logic: if multiple are intersecting, take the first one.
                    // A robust active spy needs more complex logic (keeping track of all intersecting),
                    // but for TOH, taking the first intersecting entry usually works if margin is set right.
                    
                    const visible = entries.find(e => e.isIntersecting);
                    if (visible) {
                        DomRenderer.updateActiveState(visible.target.id);
                    }
                }, {
                    rootMargin: '0px 0px -90% 0px', // Active zone is the top 10% of the screen
                    threshold: 0
                });

                idsToTrack.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) observer.observe(el);
                });
            }
        }
    }

    return { generate };
}