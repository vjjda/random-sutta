// Path: web/assets/app.js
import { initFilters, getActiveFilters } from './modules/filters.js';
import { renderSutta } from './modules/renderer.js';
import { updateURL, initCommentPopup } from './modules/utils.js';

document.addEventListener("DOMContentLoaded", () => {
    const statusDiv = document.getElementById("status");
    const randomBtn = document.getElementById("btn-random");
    const navHeader = document.getElementById("nav-header");

    // Khởi tạo Popup Comment
    const { hideComment } = initCommentPopup();

    // --- GLOBAL FUNCTION EXPORT ---
    // Cần gán vào window để các nút onclick trong HTML gọi được
    window.loadSutta = function (suttaId) {
        hideComment();
        if (renderSutta(suttaId, false)) { // false = no scroll hash check on nav
            updateURL(suttaId);
        }
    };

    // --- RANDOM LOGIC ---
    function loadRandomSutta() {
        hideComment();
        if (!window.SUTTA_DB) return;

        const allKeys = Object.keys(window.SUTTA_DB);
        if (allKeys.length === 0) return;

        const activePrefixes = getActiveFilters();
        
        // Filter logic
        const filteredKeys = allKeys.filter(key => {
            return activePrefixes.some(prefix => key.startsWith(prefix));
        });

        if (filteredKeys.length === 0) {
            alert("No suttas match your selected filters!");
            return;
        }

        const randomIndex = Math.floor(Math.random() * filteredKeys.length);
        const suttaId = filteredKeys[randomIndex];

        window.loadSutta(suttaId);
    }

    // --- INITIALIZATION ---
    function waitForData() {
        if (window.SUTTA_DB && Object.keys(window.SUTTA_DB).length > 0) {
            const count = Object.keys(window.SUTTA_DB).length;
            const nameCount = window.SUTTA_NAMES ? Object.keys(window.SUTTA_NAMES).length : 0;

            statusDiv.textContent = `Library loaded: ~${count} suttas (${nameCount} meta-entries).`;
            statusDiv.classList.remove("hidden");
            navHeader.classList.add("hidden");
            randomBtn.disabled = false;

            initFilters();

            // Check URL query
            const params = new URLSearchParams(window.location.search);
            const queryId = params.get("q");
            if (queryId) {
                renderSutta(queryId, true); // true = check hash for scroll
            }
        } else {
            statusDiv.textContent = "Loading database files...";
            setTimeout(waitForData, 100);
        }
    }

    // Event Listeners
    randomBtn.addEventListener("click", loadRandomSutta);

    window.addEventListener("popstate", (event) => {
        if (event.state && event.state.suttaId) {
            renderSutta(event.state.suttaId);
        } else {
            const params = new URLSearchParams(window.location.search);
            const queryId = params.get("q");
            if (queryId) renderSutta(queryId);
        }
    });

    // Start
    waitForData();
});