// Path: web/assets/modules/renderer.js
import { DB } from "./db_manager.js";
import { getSuttaDisplayInfo } from "./utils.js";
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js"; // [NEW] Import Factory

let tohInstance = null;

function updateTopNavDOM(currentId, prevId, nextId) {
  // Logic cập nhật DOM cho Top Nav (Header)
  const navHeader = document.getElementById("nav-header");
  const navPrevBtn = document.getElementById("nav-prev");
  const navNextBtn = document.getElementById("nav-next");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");
  const statusDiv = document.getElementById("status");

  const currentInfo = getSuttaDisplayInfo(currentId);
  if (navMainTitle) navMainTitle.textContent = currentInfo.title;
  if (navSubTitle) navSubTitle.textContent = currentInfo.subtitle;

  // Reset Display Mode
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

  navHeader.classList.remove("hidden");
  statusDiv.classList.add("hidden");
}

function handleNotFound(suttaId) {
  const container = document.getElementById("sutta-container");
  const statusDiv = document.getElementById("status");
  const navHeader = document.getElementById("nav-header");
  const mTitle = document.getElementById("nav-main-title");
  const sTitle = document.getElementById("nav-sub-title");

  // [UPDATED] Use Factory
  container.innerHTML = UIFactory.createErrorHtml(suttaId);
  
  statusDiv.textContent = "Sutta not found.";
  statusDiv.classList.remove("hidden");
  navHeader.classList.remove("hidden");

  if (mTitle) mTitle.textContent = "Not Found";
  if (sTitle) sTitle.textContent = "---";
}

export function renderSutta(suttaId, options = {}) {
  const checkHash = options.checkHash !== false;
  const explicitId = options.highlightId;
  const id = suttaId.toLowerCase().trim();
  const container = document.getElementById("sutta-container");

  // 1. Check Data Existence
  const book = DB.findBookContaining(id);
  if (!book) {
    handleNotFound(id);
    return false;
  }

  // 2. Generate Content HTML
  let htmlContent = DB.compileHtml(id);
  let isBranch = false;

  if (!htmlContent) {
    htmlContent = DB.compileBranchHtml(id);
    isBranch = true;
  }

  if (!htmlContent) return false;

  // 3. Generate Navigation HTML & Update Top Nav
  const nav = DB.getNavigation(id);
  updateTopNavDOM(id, nav.prev, nav.next);
  
  // [UPDATED] Use Factory for Bottom Nav
  const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next);

  // 4. Render to DOM
  container.innerHTML = htmlContent + bottomNavHtml;

  // 5. Setup Components (ToH)
  if (!tohInstance) tohInstance = setupTableOfHeadings();
  
  if (isBranch) {
    document.getElementById("toh-wrapper")?.classList.add("hidden");
  } else {
    tohInstance.generate();
  }

  // 6. Handle Scroll / Highlight
  let targetId = null;
  if (explicitId) {
      targetId = explicitId.replace('#', '');
  } else if (checkHash && window.location.hash) {
      targetId = window.location.hash.substring(1);
  }

  if (targetId) {
    const attemptScroll = (retries) => {
        const el = document.getElementById(targetId);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            el.classList.add("highlight");
        } else if (retries > 0) {
            setTimeout(() => attemptScroll(retries - 1), 100);
        }
    };
    attemptScroll(10);
  } else {
    window.scrollTo(0, 0);
  }

  return true;
}