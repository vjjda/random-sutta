// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
    const statusDiv = document.getElementById("status");
    const randomBtn = document.getElementById("btn-random");
    const navHeader = document.getElementById("nav-header");

    const { hideComment } = window.initCommentPopup();

    window.loadSutta = function (suttaId, shouldUpdateUrl = true) {
        hideComment();
        if (window.renderSutta(suttaId, false)) { 
            if (shouldUpdateUrl) {
                const bookParam = window.generateBookParam();
                window.updateURL(suttaId, bookParam);
            }
        }
    };

    function loadRandomSutta(shouldUpdateUrl = true) {
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

        window.loadSutta(suttaId, shouldUpdateUrl);
    }

    // --- FIX HANGING ISSUE ---
    let loadAttempts = 0;
    const MAX_ATTEMPTS = 150; // 150 * 100ms = 15 seconds timeout

    function waitForData() {
        const isDbReady = window.SUTTA_DB && Object.keys(window.SUTTA_DB).length > 0;
        const isNamesReady = window.SUTTA_NAMES && Object.keys(window.SUTTA_NAMES).length > 0;

        if (isDbReady && isNamesReady) {
            // --- SUCCESS ---
            const count = Object.keys(window.SUTTA_DB).length;
            const nameCount = Object.keys(window.SUTTA_NAMES).length;

            statusDiv.textContent = `Library loaded: ~${count} suttas (${nameCount} meta-entries).`;
            statusDiv.classList.remove("hidden");
            navHeader.classList.add("hidden");
            randomBtn.disabled = false;

            window.initFilters();

            const params = new URLSearchParams(window.location.search);
            const queryId = params.get("q");
            const isRandomLoop = params.get("r");

            if (isRandomLoop) {
                loadRandomSutta(false);
            } 
            else if (queryId) {
                window.renderSutta(queryId, true);
            } 
            else {
                loadRandomSutta(false);
                const bookParam = window.generateBookParam();
                window.updateURL(null, bookParam, true);
            }
        } else {
            // --- WAITING OR TIMEOUT ---
            loadAttempts++;
            
            if (loadAttempts > MAX_ATTEMPTS) {
                // Timeout logic
                console.error("Timeout waiting for data.");
                console.log(`DB Status: ${isDbReady}, Names Status: ${isNamesReady}`);
                
                statusDiv.innerHTML = `
                    <span style="color: red;">⚠️ Connection timeout. Data could not be loaded.</span><br>
                    <button onclick="location.reload()" style="margin-top: 10px; font-size: 14px; padding: 5px 10px;">↻ Reload Page</button>
                `;
                return; // Stop recursion
            }

            statusDiv.textContent = "Loading database files...";
            setTimeout(waitForData, 100);
        }
    }

    randomBtn.addEventListener("click", () => loadRandomSutta(true));

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