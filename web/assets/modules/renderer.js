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
  
  let bottomNavHtml = '<div class="sutta-nav">';
  
  const makeBtnImp = (sid, align) => {
       if(!sid) return `<span class="nav-spacer"></span>`;
       const info = getSuttaDisplayInfo(sid);
       const arrowLeft = align === 'left' ? '← ' : '';
       const arrowRight = align === 'right' ? ' →' : '';
       
       // [UPDATED] Tính toán align-items cho Flexbox
       const alignItems = align === 'left' ? 'flex-start' : 'flex-end';
       
       // [UPDATED] Bỏ thẻ <br>, dùng display:flex để stack dòng và kiểm soát khoảng cách (gap)
       return `<button onclick="window.loadSutta('${sid}')" class="nav-btn" style="align-items:${alignItems}">
                <span class="nav-main-text">${arrowLeft}${info.title}${arrowRight}</span>
                <span class="nav-title">${info.subtitle}</span>
              </button>`;
  };

  bottomNavHtml += makeBtnImp(nav.prev, 'left');

  // [UPDATED] Nút Random giữ nguyên SVG Dot
  bottomNavHtml += `
      <button onclick="window.triggerRandomSutta()" class="nav-random-icon" title="Random Sutta">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
           <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
  `;

  bottomNavHtml += makeBtnImp(nav.next, 'right');
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
