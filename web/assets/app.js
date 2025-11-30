// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
    const statusDiv = document.getElementById("status");
    const randomBtn = document.getElementById("btn-random");
    const navHeader = document.getElementById("nav-header");

    // Khởi tạo Popup Comment
    const { hideComment } = window.initCommentPopup();

    // Gắn hàm loadSutta vào window để các nút Previous/Next trong HTML gọi được
    window.loadSutta = function (suttaId) {
        hideComment();
        if (window.renderSutta(suttaId, false)) { 
            window.updateURL(suttaId);
        }
    };

    function loadRandomSutta() {
        hideComment();
        if (!window.SUTTA_DB) return;

        const allKeys = Object.keys(window.SUTTA_DB);
        if (allKeys.length === 0) return;

        // Gọi hàm từ filters.js qua window
        const activePrefixes = window.getActiveFilters();
        
        // --- FIX BUG LOGIC FILTER ---
        const filteredKeys = allKeys.filter(key => {
            return activePrefixes.some(prefix => {
                // 1. Phải bắt đầu bằng prefix
                if (!key.startsWith(prefix)) return false;

                // 2. CHECK NGHIÊM NGẶT:
                // Để phân biệt 'mn' với 'mnd', hoặc 'sn' với 'snp':
                // Ký tự ngay sau prefix BẮT BUỘC phải là số (0-9).
                // Ví dụ: 
                // key="mn1" (prefix="mn") -> nextChar="1" -> OK
                // key="mnd1" (prefix="mn") -> nextChar="d" -> REJECT
                
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

            // Gọi hàm init filters từ window
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