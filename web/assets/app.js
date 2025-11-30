// Path: web/assets/app.js

document.addEventListener("DOMContentLoaded", () => {
    const statusDiv = document.getElementById("status");
    const randomBtn = document.getElementById("btn-random");
    const navHeader = document.getElementById("nav-header");

    // Initialize Comment Popup Logic
    const { hideComment } = window.initCommentPopup();

    // --- CORE LOGIC ---

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
        
        // Filter keys based on selected books
        const filteredKeys = allKeys.filter(key => {
            return activePrefixes.some(prefix => {
                // Ensure prefix matching works for "dn" vs "dhp" (dn1 vs dhp1)
                // Logic: startsWith prefix AND next char is digit
                if (!key.startsWith(prefix)) return false;
                const nextChar = key.charAt(prefix.length);
                return /^\d$/.test(nextChar); // e.g. dn[1]...
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

    // --- DATA LOADING LOGIC (IMPROVED) ---
    
    let loadAttempts = 0;
    // Tăng thời gian chờ lên 120 giây (1200 * 100ms) để hỗ trợ mạng chậm
    const MAX_ATTEMPTS = 1200; 

    function waitForData() {
        // Kiểm tra an toàn xem object đã khởi tạo chưa
        const dbCount = (window.SUTTA_DB && Object.keys(window.SUTTA_DB).length) || 0;
        const nameCount = (window.SUTTA_NAMES && Object.keys(window.SUTTA_NAMES).length) || 0;

        // Điều kiện hoàn thành: Phải có dữ liệu text VÀ dữ liệu tên
        // Lưu ý: Có thể điều chỉnh logic này nếu muốn cho phép chạy khi chỉ mới load được 1 phần
        const isDbReady = dbCount > 0; 
        const isNamesReady = nameCount > 0;

        // Nếu load thành công (hoặc ít nhất đã load được lượng lớn dữ liệu)
        // Ở đây ta chờ cả 2, nhưng trong thực tế DB quan trọng hơn.
        if (isDbReady && isNamesReady) {
            
            // --- SUCCESS STATE ---
            statusDiv.textContent = `Library loaded: ${dbCount} suttas (${nameCount} meta-entries).`;
            statusDiv.classList.remove("hidden");
            // Ẩn thanh loading sau 2s để gọn giao diện (tuỳ chọn)
            setTimeout(() => { statusDiv.classList.add("hidden"); }, 3000);

            navHeader.classList.add("hidden");
            randomBtn.disabled = false;

            // Init App Logic
            window.initFilters();
            
            // Router Logic
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
                // Default: Load random but update URL cleanly
                loadRandomSutta(false);
                const bookParam = window.generateBookParam();
                window.updateURL(null, bookParam, true);
            }

        } else {
            // --- WAITING STATE ---
            loadAttempts++;

            if (loadAttempts > MAX_ATTEMPTS) {
                console.error("Timeout waiting for data.");
                console.log(`Debug Status -> DB: ${dbCount}, Names: ${nameCount}`);
                
                statusDiv.innerHTML = `
                    <span style="color: red;">⚠️ Connection timeout. Only loaded ${dbCount} suttas.</span><br>
                    <span style="font-size: 0.9em; color: #666;">Check your internet connection or try reloading.</span><br>
                    <button onclick="location.reload()" style="margin-top: 10px; cursor: pointer; padding: 5px 10px;">↻ Reload Page</button>
                `;
                return; // Stop recursion
            }

            // Hiển thị tiến độ để người dùng không hoang mang
            if (loadAttempts % 5 === 0) { // Cập nhật UI mỗi 500ms
                statusDiv.innerHTML = `Loading library... <br>Found: <b>${dbCount}</b> texts, <b>${nameCount}</b> names...`;
            }
            
            setTimeout(waitForData, 100);
        }
    }

    // Event Listeners
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

    // Start loading check
    waitForData();
});