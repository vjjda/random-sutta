// Path: web/app.js

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('sutta-container');
    const statusDiv = document.getElementById('status');
    const randomBtn = document.getElementById('btn-random');
    
    let suttaKeys = [];

    // 1. Initialize & Check Data
    function init() {
        if (typeof SUTTA_DB !== 'undefined') {
            suttaKeys = Object.keys(SUTTA_DB);
            statusDiv.textContent = `Library loaded: ${suttaKeys.length} suttas available.`;
            statusDiv.style.color = "#666";
            
            // Enable button
            randomBtn.disabled = false;
        } else {
            statusDiv.textContent = "⚠️ Error: Database not found. Please run the python processor.";
            statusDiv.style.color = "red";
            randomBtn.disabled = true;
        }
    }

    // 2. Random Logic
    function loadRandomSutta() {
        if (suttaKeys.length === 0) return;

        // Pick random ID
        const randomIndex = Math.floor(Math.random() * suttaKeys.length);
        const suttaId = suttaKeys[randomIndex];
        const content = SUTTA_DB[suttaId];

        // Render
        container.innerHTML = content;
        
        // Update status
        statusDiv.textContent = `Displaying: ${suttaId.toUpperCase()}`;
        
        // Scroll to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 3. Bind Events
    randomBtn.addEventListener('click', loadRandomSutta);

    // Run init
    init();
});