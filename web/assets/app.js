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
            const isRandomLoop = params.get("r");

            if (isRandomLoop) {
                // CASE A: Đang ở chế độ F5 Loop
                // Load random nhưng GIỮ NGUYÊN URL (không xóa ?r=1, không thêm ?q=...)
                loadRandomSutta(false);
            } 
            else if (queryId) {
                // CASE B: Có link bài cụ thể
                window.renderSutta(queryId, true);
            } 
            else {
                // CASE C: Mặc định (Vào trang chủ trắng)
                // 1. Load random ngay lập tức (nhưng khoan update URL theo kiểu thường)
                loadRandomSutta(false);
                
                // 2. Cập nhật URL: Thêm ?r=1 để lần sau F5 sẽ ra bài khác
                const bookParam = window.generateBookParam();
                // Tham số thứ 3 = true nghĩa là bật Random Mode
                window.updateURL(null, bookParam, true);
            }
        } else {
            statusDiv.textContent = "Loading database files...";
            setTimeout(waitForData, 100);
        }
    }

    // Nút bấm: Vẫn hoạt động như cũ (Update URL ra ?q=... để ghim bài kinh đó)
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