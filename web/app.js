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
            return false; // Báo thất bại
        }

        // Render Content
        container.innerHTML = SUTTA_DB[id];
        
        // Update Status
        statusDiv.textContent = `Displaying: ${id.toUpperCase()}`;
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true; // Báo thành công
    }

    // 2. Update Browser URL (Fix: Sử dụng URL Object chuẩn)
    function updateURL(suttaId) {
        try {
            // Lấy URL hiện tại
            const currentUrl = new URL(window.location);
            
            // Set tham số 'q' (Nó sẽ tự thêm nếu chưa có, hoặc sửa nếu đã có)
            currentUrl.searchParams.set('q', suttaId);
            
            // Push state: Thay đổi URL trên thanh địa chỉ
            window.history.pushState({ suttaId: suttaId }, '', currentUrl);
        } catch (e) {
            // Phòng trường hợp chạy file:// trên một số trình duyệt cũ chặn pushState
            console.warn("Could not update URL (likely due to file:// protocol restrictions):", e);
        }
    }

    // 3. Random Logic
    function loadRandomSutta() {
        if (suttaKeys.length === 0) return;

        // Pick random ID
        const randomIndex = Math.floor(Math.random() * suttaKeys.length);
        const suttaId = suttaKeys[randomIndex];

        // Render
        const success = renderSutta(suttaId);
        
        // Chỉ đổi URL khi render thành công
        if (success) {
            updateURL(suttaId);
        }
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
                // Nếu link đã có ID, load nó
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
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.suttaId) {
            // Restore sutta from history state
            renderSutta(event.state.suttaId);
        } else {
            // Nếu back về trang chủ (không có query), kiểm tra lại URL
            const params = new URLSearchParams(window.location.search);
            const queryId = params.get('q');
            
            if(queryId) {
                 renderSutta(queryId);
            } else {
                // Trạng thái ban đầu
                container.innerHTML = '<p class="placeholder">Click the button to load a sutta.</p>';
                statusDiv.textContent = `Library loaded: ${suttaKeys.length} suttas available.`;
            }
        }
    });

    // Run
    init();
});