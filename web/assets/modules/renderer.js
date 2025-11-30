// Path: web/assets/modules/renderer.js

// Hàm helper nội bộ (không cần export window vì chỉ dùng trong file này)
function updateTopNavLocal(currentId, prevId, nextId) {
    // LẤY ELEMENT KHI HÀM CHẠY (Lúc này HTML đã load xong)
    const navHeader = document.getElementById("nav-header");
    const navPrevBtn = document.getElementById("nav-prev");
    const navNextBtn = document.getElementById("nav-next");
    const navMainTitle = document.getElementById("nav-main-title");
    const navSubTitle = document.getElementById("nav-sub-title");
    const statusDiv = document.getElementById("status");

    const currentInfo = window.getSuttaDisplayInfo(currentId);
    
    navMainTitle.textContent = currentInfo.title;
    navSubTitle.textContent = currentInfo.subtitle;

    if (prevId) {
        navPrevBtn.disabled = false;
        navPrevBtn.onclick = () => window.loadSutta(prevId);
        navPrevBtn.title = `Previous: ${window.getSuttaDisplayInfo(prevId).title}`;
    } else {
        navPrevBtn.disabled = true;
        navPrevBtn.onclick = null;
        navPrevBtn.title = "";
    }

    if (nextId) {
        navNextBtn.disabled = false;
        navNextBtn.onclick = () => window.loadSutta(nextId);
        navNextBtn.title = `Next: ${window.getSuttaDisplayInfo(nextId).title}`;
    } else {
        navNextBtn.disabled = true;
        navNextBtn.onclick = null;
        navNextBtn.title = "";
    }

    navHeader.classList.remove("hidden");
    statusDiv.classList.add("hidden");
}

// Gắn hàm chính vào window
window.renderSutta = function(suttaId, checkHash = true) {
    // LẤY ELEMENT KHI HÀM CHẠY
    const container = document.getElementById("sutta-container");
    const statusDiv = document.getElementById("status");
    const navHeader = document.getElementById("nav-header");

    const id = suttaId.toLowerCase().trim();
    
    if (!window.SUTTA_DB || !window.SUTTA_DB[id]) {
        container.innerHTML = `<p class="placeholder" style="color:red">Sutta ID "<b>${id}</b>" not found.</p>`;
        statusDiv.textContent = "Error: Sutta not found.";
        statusDiv.classList.remove("hidden");
        navHeader.classList.add("hidden");
        return false;
    }

    const data = window.SUTTA_DB[id];
    
    // 1. Update Top Nav
    updateTopNavLocal(id, data.previous, data.next);

    // 2. Build Bottom Nav
    let bottomNavHtml = '<div class="sutta-nav">';
    if (data.previous) {
        const prevInfo = window.getSuttaDisplayInfo(data.previous);
        const prevLabel = `← ${prevInfo.title}<br><span class="nav-title">${prevInfo.subtitle}</span>`;     
        bottomNavHtml += `<button onclick="window.loadSutta('${data.previous}')" class="nav-btn">${prevLabel}</button>`;
    } else {
        bottomNavHtml += `<span></span>`;
    }

    if (data.next) {
        const nextInfo = window.getSuttaDisplayInfo(data.next);
        const nextLabel = `${nextInfo.title} →<br><span class="nav-title">${nextInfo.subtitle}</span>`;
        bottomNavHtml += `<button onclick="window.loadSutta('${data.next}')" class="nav-btn">${nextLabel}</button>`;
    }
    bottomNavHtml += "</div>";

    // 3. Inject
    container.innerHTML = data.content + bottomNavHtml;
    
    // 4. Scroll Logic
    const hash = window.location.hash;
    if (checkHash && hash) {
        const targetId = hash.substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
            targetElement.classList.add("highlight");
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    return true;
};