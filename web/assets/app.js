// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
    const statusDiv = document.getElementById("status");
    const randomBtn = document.getElementById("btn-random");
    const navHeader = document.getElementById("nav-header");

    const { hideComment } = window.initCommentPopup();

    // UPDATED: Thêm tham số shouldUpdateUrl (mặc định true)
    window.loadSutta = function (suttaId, shouldUpdateUrl = true) {
        hideComment();
        if (window.renderSutta(suttaId, false)) { 
            if (shouldUpdateUrl) {
                const bookParam = window.generateBookParam();
                window.updateURL(suttaId, bookParam);
            }
        }
    };

    // UPDATED: Thêm tham số shouldUpdateUrl
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

        // Truyền tiếp tham số shouldUpdateUrl
        window.loadSutta(suttaId, shouldUpdateUrl);
    }

    function waitForData() {
        if (window.SUTTA_DB && Object.keys(window.SUTTA_DB).length > 0) {
            const count = Object.keys(window.SUTTA_DB).length;
            const nameCount = window.SUTTA_NAMES ? Object.keys(window.SUTTA_NAMES).length : 0;

            statusDiv.textContent = `Library loaded: ~${count} suttas (${nameCount} meta-entries).`;
            statusDiv.classList.remove("hidden");
            navHeader.classList.add("hidden");
            randomBtn.disabled = false;

            // 1. Init Filters (xử lý ?b=)
            window.initFilters();

            // 2. Kiểm tra Logic Load
            const params = new URLSearchParams(window.location.search);
            const queryId = params.get("q");
            const isRandomLoop = params.get("r"); // Kiểm tra tham số r

            if (isRandomLoop) {
                // CASE A: Chế độ Random Loop (?r=true)
                // Load random bài mới NHƯNG không update URL (để giữ nguyên ?r=true cho lần F5 sau)
                loadRandomSutta(false);
            } 
            else if (queryId) {
                // CASE B: Có link bài cụ thể -> Load bài đó
                window.renderSutta(queryId, true);
            } 
            else {
                // CASE C: Mặc định (Vào trang chủ) -> Random bài mới VÀ update URL thành ?q=...
                loadRandomSutta(true);
            }
        } else {
            statusDiv.textContent = "Loading database files...";
            setTimeout(waitForData, 100);
        }
    }

    // Nút bấm luôn update URL (thoát khỏi chế độ r nếu đang có)
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