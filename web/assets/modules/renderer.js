// Path: web/assets/modules/renderer.js
import { DB } from "./db_manager.js";
import { getSuttaDisplayInfo } from "./utils.js";
import { setupTableOfHeadings } from "./toh_component.js";

// Singleton instance cho Table of Headings
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
      // window.loadSutta được định nghĩa ở app.js
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

  // --- XỬ LÝ LỖI KHÔNG TÌM THẤY ---
  if (!book) {
    const scLink = `https://suttacentral.net/${id}/en/sujato`;
    container.innerHTML = `
        <div class="error-message">
            <p style="color: #d35400; font-weight: bold; font-size: 1.2rem;">Sutta ID "${id}" not found.</p>
            <p>You can try checking on SuttaCentral:</p>
            <p><a href="${scLink}" target="_blank" rel="noopener noreferrer" class="sc-link">SuttaCentral ➜</a></p>
        </div>`;
    statusDiv.textContent = "Sutta not found.";
    statusDiv.classList.remove("hidden");
    navHeader.classList.remove("hidden");

    const mTitle = document.getElementById("nav-main-title");
    const sTitle = document.getElementById("nav-sub-title");
    if (mTitle) mTitle.textContent = "Not Found";
    if (sTitle) sTitle.textContent = "---";

    return false;
  }

  // --- RENDER NỘI DUNG ---
  // 1. Thử render dạng Bài kinh (Leaf)
  let htmlContent = DB.compileHtml(id);
  let isBranch = false;

  // 2. Nếu không được, thử render dạng Mục lục (Branch)
  if (!htmlContent) {
    htmlContent = DB.compileBranchHtml(id);
    isBranch = true;
  }

  // Nếu cả 2 đều thất bại
  if (!htmlContent) {
    return false;
  }

  // --- RENDER TOP NAVIGATION ---
  const nav = DB.getNavigation(id);
  updateTopNavLocal(id, nav.prev, nav.next);

  // --- RENDER BOTTOM NAVIGATION ---
  let bottomNavHtml = '<div class="sutta-nav">';

  const makeBtnImp = (sid, align) => {
    if (!sid) return `<div class="nav-spacer"></div>`;
    const info = getSuttaDisplayInfo(sid);

    // [NEW] Sử dụng SVG thay vì text arrow
    // Lưu ý: class "nav-icon" sẽ được thêm vào CSS bên dưới nếu cần chỉnh riêng
    const arrowLeft =
      align === "left"
        ? `<svg class="nav-icon-inline left" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`
        : "";

    const arrowRight =
      align === "right"
        ? `<svg class="nav-icon-inline right" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`
        : "";

    const alignItems = align === "left" ? "flex-start" : "flex-end";

    // Sửa lại cấu trúc HTML một chút để icon thẳng hàng với text
    return `<button onclick="window.loadSutta('${sid}')" class="nav-btn" style="align-items:${alignItems}; text-align:${align}">
            <span class="nav-main-text">
                ${arrowLeft}
                <span>${info.title}</span>
                ${arrowRight}
            </span>
            <span class="nav-title">${info.subtitle}</span>
          </button>`;
  };

  // Nút Trái
  bottomNavHtml += makeBtnImp(nav.prev, "left");

  // Nút Giữa (Random Dot)
  bottomNavHtml += `
      <button onclick="window.triggerRandomSutta()" class="nav-random-icon" title="Random Sutta">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
           <circle cx="12" cy="12" r="2"></circle>
        </svg>
      </button>
  `;

  // Nút Phải
  bottomNavHtml += makeBtnImp(nav.next, "right");
  bottomNavHtml += "</div>";

  container.innerHTML = htmlContent + bottomNavHtml;

  // --- RENDER TABLE OF HEADINGS (ToH) ---
  if (!tohInstance) {
    tohInstance = setupTableOfHeadings();
  }

  // Nếu là Branch thì ẩn ToH (vì chính nó là mục lục rồi)
  // Nếu là Leaf thì tạo ToH
  if (isBranch) {
    document.getElementById("toh-wrapper")?.classList.add("hidden");
  } else {
    tohInstance.generate();
  }

  // --- XỬ LÝ SCROLL / HASH ---
  if (checkHash && window.location.hash) {
    const targetId = window.location.hash.substring(1);

    // Hàm đệ quy thử tìm và scroll
    const attemptScroll = (retriesLeft) => {
      const el = document.getElementById(targetId);

      if (el) {
        // Tìm thấy! Cuộn và highlight ngay
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("highlight");
        console.log(`📍 Scrolled to #${targetId}`);
      } else if (retriesLeft > 0) {
        // Chưa thấy? Đợi 100ms rồi thử lại (Max 10 lần = 1 giây)
        // Giúp xử lý độ trễ khi render bài kinh dài
        setTimeout(() => attemptScroll(retriesLeft - 1), 100);
      } else {
        console.warn(`⚠️ Could not find element #${targetId} after retries.`);
      }
    };

    // Bắt đầu thử (Thử 10 lần, mỗi lần cách nhau 100ms)
    attemptScroll(10);
  } else {
    window.scrollTo(0, 0);
  }
  
  return true;
}
