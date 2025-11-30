// Path: web/app.js

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('sutta-container');
    const statusDiv = document.getElementById('status');
    const randomBtn = document.getElementById('btn-random');
    
    // --- Core Functions ---

    function renderSutta(suttaId) {
        const id = suttaId.toLowerCase().trim();

        if (!window.SUTTA_DB || !window.SUTTA_DB[id]) {
            container.innerHTML = `<p class="placeholder" style="color:red">⚠️ Sutta ID "<b>${id}</b>" not found.</p>`;
            statusDiv.textContent = "Error: Sutta not found.";
            return false;
        }

        const data = window.SUTTA_DB[id];
        
        // Build Navigation HTML
        let navHtml = '<div class="sutta-nav">';
        if (data.previous) {
            navHtml += `<button onclick="window.loadSutta('${data.previous}')">← ${data.previous.toUpperCase()}</button>`;
        } else {
            navHtml += `<span></span>`; // Spacer
        }
        
        if (data.next) {
            navHtml += `<button onclick="window.loadSutta('${data.next}')">${data.next.toUpperCase()} →</button>`;
        }
        navHtml += '</div>';

        // Render Content + Nav
        container.innerHTML = navHtml + data.content + navHtml;
        
        statusDiv.textContent = `Displaying: ${id.toUpperCase()}`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
    }

    function updateURL(suttaId) {
        try {
            const currentUrl = new URL(window.location);
            currentUrl.searchParams.set('q', suttaId);
            window.history.pushState({ suttaId: suttaId }, '', currentUrl);
        } catch (e) {
            console.warn("Could not update URL:", e);
        }
    }

    // Expose loadSutta to global scope for nav buttons
    window.loadSutta = function(suttaId) {
        if (renderSutta(suttaId)) {
            updateURL(suttaId);
        }
    };

    function loadRandomSutta() {
        if (!window.SUTTA_DB) return;
        
        const keys = Object.keys(window.SUTTA_DB);
        if (keys.length === 0) return;

        const randomIndex = Math.floor(Math.random() * keys.length);
        const suttaId = keys[randomIndex];
        
        window.loadSutta(suttaId);
    }

    // --- Initialization ---

    function waitForData() {
        if (window.SUTTA_DB && Object.keys(window.SUTTA_DB).length > 0) {
            const count = Object.keys(window.SUTTA_DB).length;
            statusDiv.textContent = `Library loaded: ~${count} suttas available.`;
            statusDiv.style.color = "#666";
            randomBtn.disabled = false;
            
            const params = new URLSearchParams(window.location.search);
            const queryId = params.get('q');
            if (queryId) {
                renderSutta(queryId);
            }
        } else {
            statusDiv.textContent = "Loading database files...";
            setTimeout(waitForData, 100);
        }
    }

    randomBtn.addEventListener('click', loadRandomSutta);

    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.suttaId) {
            renderSutta(event.state.suttaId);
        } else {
            const params = new URLSearchParams(window.location.search);
            const queryId = params.get('q');
            if(queryId) renderSutta(queryId);
        }
    });

    waitForData();
});