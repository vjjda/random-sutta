// Path: web/assets/modules/renderer.js
import { DB } from "./db_manager.js";
import { getSuttaDisplayInfo } from "./utils.js";
import { setupTableOfHeadings } from "./toh_component.js"; // [NEW]

// Singleton instance
let tohInstance = null;

function updateTopNavLocal(currentId, prevId, nextId) {
  const navHeader = document.getElementById("nav-header");
  const navPrevBtn = document.getElementById("nav-prev");
  const navNextBtn = document.getElementById("nav-next");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");
  const statusDiv = document.getElementById("status");

  const currentInfo = getSuttaDisplayInfo(currentId);

  if (navMainTitle) navMainTitle.textContent = currentInfo.title;
  if (navSubTitle) navSubTitle.textContent = currentInfo.subtitle;

  const textMode = document.getElementById("nav-title-text");
  const inputMode = document.getElementById("nav-search-container");
  if (textMode && inputMode) {
    textMode.classList.remove("hidden");
    inputMode.classList.add("hidden");
  }

  const setupBtn = (btn, id, type) => {
    if (id) {
      btn.disabled = false;
      // window.loadSutta sẽ được gán ở app.js
      btn.onclick = () => window.loadSutta(id);
      btn.title = `${type}: ${getSuttaDisplayInfo(id).title}`;
    } else {
      btn.disabled = true;
      btn.onclick = null;
      btn.title = "";
    }
  };

  setupBtn(navPrevBtn, prevId, "Previous");
  setupBtn(navNextBtn, nextId, "Next");

  navHeader.classList.remove("hidden");
  statusDiv.classList.add("hidden");
}

export function renderSutta(suttaId, checkHash = true) {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const navHeader = document.getElementById("nav-header");
  const id = suttaId.toLowerCase().trim();
  const book = DB.findBookContaining(id);

  if (!book) {
    const scLink = `https://suttacentral.net/${id}/en/sujato`;
    container.innerHTML = `
        <div class="error-message">
            <p style="color: #d35400; font-weight: bold; font-size: 1.2rem;">ID "${id}" not found.</p>
            <p>You can try checking on SuttaCentral:</p>
            <p><a href="${scLink}" target="_blank" rel="noopener noreferrer" class="sc-link">SuttaCentral ➜</a></p>
        </div>`;
    statusDiv.textContent = "Sutta not found.";
    statusDiv.classList.remove("hidden");
    navHeader.classList.remove("hidden");

    // Reset title display
    const mTitle = document.getElementById("nav-main-title");
    const sTitle = document.getElementById("nav-sub-title");
    if (mTitle) mTitle.textContent = "Not Found";
    if (sTitle) sTitle.textContent = "---";

    return false;
  }

  // 1. Thử render LEAF (Bài kinh)
  let htmlContent = DB.compileHtml(id);
  let isBranch = false;

  // 2. Nếu không phải Leaf, thử render BRANCH (Mục lục nhóm)
  if (!htmlContent) {
    htmlContent = DB.compileBranchHtml(id);
    isBranch = true;
  }

  // Nếu cả 2 đều không được -> Lỗi (dù đã tìm thấy sách nhưng ID không hợp lệ)
  if (!htmlContent) {
    // Fallback error...
    return false;
  }

  const nav = DB.getNavigation(id);
  updateTopNavLocal(id, nav.prev, nav.next);

  // [UPDATED] Tạo Bottom Nav cho CẢ Leaf và Branch
  // Trước đây: if (!isBranch) { ... } -> Giờ xóa if đi để luôn chạy
  
  let bottomNavHtml = '<div class="sutta-nav">';
  
  const makeBtn = (sid, align) => {
      if(!sid) return `<span></span>`;
      const info = getSuttaDisplayInfo(sid);
      
      // Icon mũi tên
      const arrowLeft = align === 'left' ? '← ' : '';
      const arrowRight = align === 'right' ? ' →' : '';
      
      return `<button onclick="window.loadSutta('${sid}')" class="nav-btn" style="text-align:${align}">
                <span class="nav-main-text">${arrowLeft}${info.title}${arrowRight}</span>
                <br>
                <span class="nav-title">${info.subtitle}</span>
              </button>`;
  };

  bottomNavHtml += makeBtn(nav.prev, 'left');
  bottomNavHtml += `
      <button onclick="window.triggerRandomSutta()" class="nav-random-icon" title="Random Sutta">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
           <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
           <circle cx="12" cy="12" r="1"></circle>
           <circle cx="8" cy="8" r="1"></circle>
           <circle cx="16" cy="16" r="1"></circle>
           <circle cx="8" cy="16" r="1"></circle>
           <circle cx="16" cy="8" r="1"></circle>
        </svg>
      </button>
  `;
  bottomNavHtml += makeBtn(nav.next, 'right');
  bottomNavHtml += "</div>";

  container.innerHTML = htmlContent + bottomNavHtml;

  // Xử lý ToH (Table of Headings)
  if (!tohInstance) {
      tohInstance = setupTableOfHeadings();
  }
  // Nếu là Branch thì ẩn ToH (vì bản thân nó đã là mục lục rồi), hoặc tùy bạn.
  // Thường Branch view ngắn, không cần ToH.
  if (isBranch) {
      document.getElementById("toh-wrapper")?.classList.add("hidden");
  } else {
      tohInstance.generate();
  }

  if (checkHash && window.location.hash) {
    const targetId = window.location.hash.substring(1);
    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight");
      } else {
        window.scrollTo(0, 0);
      }
    }, 0);
  } else {
    window.scrollTo(0, 0);
  }

  return true;
}
