// Path: web/assets/modules/renderer.js
// Xóa import getSuttaDisplayInfo

const container = document.getElementById("sutta-container");
const statusDiv = document.getElementById("status");
const navHeader = document.getElementById("nav-header");
const navPrevBtn = document.getElementById("nav-prev");
const navNextBtn = document.getElementById("nav-next");
const navMainTitle = document.getElementById("nav-main-title");
const navSubTitle = document.getElementById("nav-sub-title");

function updateTopNav(currentId, prevId, nextId) {
    const currentInfo = getSuttaDisplayInfo(currentId);
    
    navMainTitle.textContent = currentInfo.title;
    navSubTitle.textContent = currentInfo.subtitle;

    if (prevId) {
        navPrevBtn.disabled = false;
        navPrevBtn.onclick = () => window.loadSutta(prevId);
        navPrevBtn.title = `Previous: ${getSuttaDisplayInfo(prevId).title}`;
    } else {
        navPrevBtn.disabled = true;
        navPrevBtn.onclick = null;
        navPrevBtn.title = "";
    }

    if (nextId) {
        navNextBtn.disabled = false;
        navNextBtn.onclick = () => window.loadSutta(nextId);
        navNextBtn.title = `Next: ${getSuttaDisplayInfo(nextId).title}`;
    } else {
        navNextBtn.disabled = true;
        navNextBtn.onclick = null;
        navNextBtn.title = "";
    }

    navHeader.classList.remove("hidden");
    statusDiv.classList.add("hidden");
}

function renderSutta(suttaId, checkHash = true) {
    const id = suttaId.toLowerCase().trim();
    
    if (!window.SUTTA_DB || !window.SUTTA_DB[id]) {
        container.innerHTML = `<p class="placeholder" style="color:red">Sutta ID "<b>${id}</b>" not found.</p>`;
        statusDiv.textContent = "Error: Sutta not found.";
        statusDiv.classList.remove("hidden");
        navHeader.classList.add("hidden");
        return false;
    }

    const data = window.SUTTA_DB[id];
    
    updateTopNav(id, data.previous, data.next);

    let bottomNavHtml = '<div class="sutta-nav">';
    if (data.previous) {
        const prevInfo = getSuttaDisplayInfo(data.previous);
        const prevLabel = `← ${prevInfo.title}<br><span class="nav-title">${prevInfo.subtitle}</span>`;     
        bottomNavHtml += `<button onclick="window.loadSutta('${data.previous}')" class="nav-btn">${prevLabel}</button>`;
    } else {
        bottomNavHtml += `<span></span>`;
    }

    if (data.next) {
        const nextInfo = getSuttaDisplayInfo(data.next);
        const nextLabel = `${nextInfo.title} →<br><span class="nav-title">${nextInfo.subtitle}</span>`;
        bottomNavHtml += `<button onclick="window.loadSutta('${data.next}')" class="nav-btn">${nextLabel}</button>`;
    }
    bottomNavHtml += "</div>";

    container.innerHTML = data.content + bottomNavHtml;
    
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
}