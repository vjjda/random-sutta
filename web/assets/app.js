// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
    const statusDiv = document.getElementById("status");
    const randomBtn = document.getElementById("btn-random");
    const navHeader = document.getElementById("nav-header");

    const { hideComment } = window.initCommentPopup();

    // Helper: Tính toán tham số ?b=
    function getBookUrlParam() {
        const active = window.getActiveFilters(); // Lấy từ filters.js
        const defaults = window.PRIMARY_BOOKS;    // Lấy từ constants.js

        // 1. Nếu số lượng khác nhau -> Chắc chắn là Custom -> Trả về string
        if (active.length !== defaults.length) {
            return active.join(",");
        }

        // 2. Nếu số lượng bằng nhau, kiểm tra nội dung
        // (Dùng Set để so sánh nhanh)
        const activeSet = new Set(active);
        for (let book of defaults) {
            if (!activeSet.has(book)) {
                return active.join(","); // Có sách lạ -> Custom
            }
        }

        // 3. Nếu giống hệt Default -> Trả về null (để utils xóa ?b= đi cho gọn link)
        return null;
    }

    window.loadSutta = function (suttaId) {
        hideComment();
        if (window.renderSutta(suttaId, false)) { 
            // UPDATED: Truyền thêm tham số sách vào URL
            const bookParam = getBookUrlParam();
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