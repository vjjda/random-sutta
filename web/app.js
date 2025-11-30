// Path: web/app.js

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('sutta-container');
    const statusDiv = document.getElementById('status');
    const randomBtn = document.getElementById('btn-random');
    
    let suttaKeys = [];

    // --- Core Functions ---

    // 1. Render Sutta to View (Chỉ hiển thị, không đổi URL)
    function renderSutta(suttaId) {
        // Normalize ID (lowercase, trim) to match DB keys
        const id = suttaId.toLowerCase().trim();

        if (!SUTTA_DB[id]) {
            container.innerHTML = `<p class="placeholder" style="color:red">⚠️ Sutta ID "<b>${id}</b>" not found in database.</p>`;
            statusDiv.textContent = "Error: Sutta not found.";
            return false;
        }

        // Render Content
        container.innerHTML = SUTTA_DB[id];
        
        // Update Status
        statusDiv.textContent = `Displaying: ${id.toUpperCase()}`;
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
    }

    // 2. Update Browser URL (Thay đổi URL mà không reload)
    function updateURL(suttaId) {
        const newUrl = `${window.location.pathname}?q=${suttaId}`;
        // pushState helps the "Back" button work correctly
        window.history.pushState({ suttaId: suttaId }, '', newUrl);
    }

    // 3. Random Logic
    function loadRandomSutta() {
        if (suttaKeys.length === 0) return;

        // Pick random ID
        const randomIndex = Math.floor(Math.random() * suttaKeys.length);
        const suttaId = suttaKeys[randomIndex];

        // Render & Update URL
        renderSutta(suttaId);
        updateURL(suttaId);
    }

    // --- Initialization ---

    function init() {
        if (typeof SUTTA_DB !== 'undefined') {
            suttaKeys = Object.keys(SUTTA_DB);
            statusDiv.textContent = `Library loaded: ${suttaKeys.length} suttas available.`;
            statusDiv.style.color = "#666";
            randomBtn.disabled = false;

            // A. Check URL for query param ?q=...
            const params = new URLSearchParams(window.location.search);
            const queryId = params.get('q');

            if (queryId) {
                // If ID exists in URL, load it immediately
                renderSutta(queryId);
            }

        } else {
            statusDiv.textContent = "⚠️ Error: Database not found. Please run the python processor.";
            statusDiv.style.color = "red";
            randomBtn.disabled = true;
        }
    }

    // --- Event Bindings ---

    // Click Random
    randomBtn.addEventListener('click', loadRandomSutta);

    // Handle Browser "Back" Button
    // (When user clicks Back, we need to reload the previous sutta from history)
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.suttaId) {
            renderSutta(event.state.suttaId);
        } else {
            // If going back to the homepage (no ID), clear content or reload init
            const params = new URLSearchParams(window.location.search);
            const queryId = params.get('q');
            if(queryId) {
                 renderSutta(queryId);
            } else {
                container.innerHTML = '<p class="placeholder">Click the button to load a sutta.</p>';
                statusDiv.textContent = `Library loaded: ${suttaKeys.length} suttas available.`;
            }
        }
    });

    // Run
    init();
});