// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
    const statusDiv = document.getElementById("status");
    const randomBtn = document.getElementById("btn-random");
    const navHeader = document.getElementById("nav-header");

    const { hideComment } = window.initCommentPopup();

    window.loadSutta = function (suttaId) {
        hideComment();
        if (window.renderSutta(suttaId, false)) { 
            // UPDATED: Dùng hàm từ filters.js
            const bookParam = window.generateBookParam();
            window.updateURL(suttaId, bookParam);
        }
    };

    function loadRandomSutta() {
        hideComment();
        if (!window.SUTTA_DB) return;

        const allKeys = Object.keys(window.SUTTA_DB);
        if (allKeys.length === 0) return;

        const activePrefixes = window.getActiveFilters();
        
        const filteredKeys = allKeys.filter(key => {
            return activePrefixes.some(prefix => {
                if (!key.startsWith(prefix)) return false;
                const nextChar = key.charAt(prefix.length);
                return /^\d$/.test(nextChar);
            });
        });

        if (filteredKeys.length === 0) {
            alert("No suttas match your selected filters!");
            return;
        }

        const randomIndex = Math.floor(Math.random() * filteredKeys.length);
        const suttaId = filteredKeys[randomIndex];

        window.loadSutta(suttaId);
    }

    function waitForData() {
        if (window.SUTTA_DB && Object.keys(window.SUTTA_DB).length > 0) {
            const count = Object.keys(window.SUTTA_DB).length;
            const nameCount = window.SUTTA_NAMES ? Object.keys(window.SUTTA_NAMES).length : 0;

            statusDiv.textContent = `Library loaded: ~${count} suttas (${nameCount} meta-entries).`;
            statusDiv.classList.remove("hidden");
            navHeader.classList.add("hidden");
            randomBtn.disabled = false;

            window.initFilters();

            const params = new URLSearchParams(window.location.search);
            const queryId = params.get("q");
            if (queryId) {
                window.renderSutta(queryId, true);
            }
        } else {
            statusDiv.textContent = "Loading database files...";
            setTimeout(waitForData, 100);
        }
    }

    randomBtn.addEventListener("click", loadRandomSutta);

    window.addEventListener("popstate", (event) => {
        if (event.state && event.state.suttaId) {
            window.renderSutta(event.state.suttaId);
        } else {
            const params = new URLSearchParams(window.location.search);
            const queryId = params.get("q");
            if (queryId) window.renderSutta(queryId);
        }
    });

    waitForData();
});