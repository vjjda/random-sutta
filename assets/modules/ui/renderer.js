// Path: web/assets/modules/ui/renderer.js
import { DB } from "../data/db_manager.js";
import { getSuttaDisplayInfo } from "../data/sutta_info_provider.js";
import { ContentCompiler } from "../data/content_compiler.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";

let tohInstance = null;

function updateTopNavDOM(currentId, prevId, nextId) {
  // Logic cập nhật DOM cho Top Nav (Header)
  const navHeader = document.getElementById("nav-header");
  const navPrevBtn = document.getElementById("nav-prev");
  const navNextBtn = document.getElementById("nav-next");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");
  const statusDiv = document.getElementById("status");

  // [QUAN TRỌNG] Lấy thông tin tiêu đề
  const currentInfo = getSuttaDisplayInfo(currentId);
  if (navMainTitle) navMainTitle.textContent = currentInfo.title;
  if (navSubTitle) navSubTitle.textContent = currentInfo.subtitle;

  document.getElementById("nav-title-text")?.classList.remove("hidden");
  document.getElementById("nav-search-container")?.classList.add("hidden");

  const setupBtn = (btn, id, type) => {
    if (id) {
      btn.disabled = false;
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

  // Đảm bảo header hiện ra
  navHeader.classList.remove("hidden");
  statusDiv.classList.add("hidden");
}

function handleNotFound(suttaId) {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const navHeader = document.getElementById("nav-header");

  container.innerHTML = UIFactory.createErrorHtml(suttaId);
  statusDiv.textContent = "Sutta not found.";
  statusDiv.classList.remove("hidden");
  navHeader.classList.remove("hidden");

  const mTitle = document.getElementById("nav-main-title");
  const sTitle = document.getElementById("nav-sub-title");
  if (mTitle) mTitle.textContent = "Not Found";
  if (sTitle) sTitle.textContent = "---";
}

export function renderSutta(suttaId, options = {}) {
  const id = suttaId.toLowerCase().trim();
  const container = document.getElementById("sutta-container");
  const book = DB.findBookContaining(id);

  if (!book) {
    handleNotFound(id);
    return false;
  }

  // Compile HTML
  let htmlContent = ContentCompiler.compileHtml(id);
  let isBranch = false;
  if (!htmlContent) {
    htmlContent = ContentCompiler.compileBranchHtml(id);
    isBranch = true;
  }
  if (!htmlContent) return false;

  // Lấy thông tin điều hướng
  const nav = DB.getNavigation(id);

  // [FIX] BỎ COMMENT DÒNG NÀY ĐỂ TITLE HIỆN RA
  updateTopNavDOM(id, nav.prev, nav.next);

  // Render HTML vào container
  const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next);
  container.innerHTML = htmlContent + bottomNavHtml;

  // Setup Table of Headings
  if (!tohInstance) tohInstance = setupTableOfHeadings();
  
  if (isBranch) {
    document.getElementById("toh-wrapper")?.classList.add("hidden");
  } else {
    tohInstance.generate();
  }

  return true;
}