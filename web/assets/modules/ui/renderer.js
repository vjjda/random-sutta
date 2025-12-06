// Path: web/assets/modules/ui/renderer.js
import { ContentCompiler } from "../data/content_compiler.js"; // Cần sửa file này nữa
import { setupTableOfHeadings } from "./toh_component.js";
import { UIFactory } from "./ui_factory.js";
import { calculateNavigation } from "./navigator.js"; // Import từ navigator

let tohInstance = null;

// [NEW] Helper lấy title từ data object đã load
function getDisplayInfo(data) {
    if (!data || !data.meta) return { title: "Unknown", subtitle: "" };
    return {
        title: data.meta.translated_title || data.uid,
        subtitle: data.meta.original_title || ""
    };
}

function updateTopNavDOM(data, prevId, nextId) {
  const navHeader = document.getElementById("nav-header");
  const navPrevBtn = document.getElementById("nav-prev");
  const navNextBtn = document.getElementById("nav-next");
  const navMainTitle = document.getElementById("nav-main-title");
  const navSubTitle = document.getElementById("nav-sub-title");
  const statusDiv = document.getElementById("status");

  const info = getDisplayInfo(data);
  if (navMainTitle) navMainTitle.textContent = info.title;
  if (navSubTitle) navSubTitle.textContent = info.subtitle;

  document.getElementById("nav-title-text")?.classList.remove("hidden");
  document.getElementById("nav-search-container")?.classList.add("hidden");

  // Setup Buttons (Cần logic lấy title cho prev/next - sẽ xử lý sau hoặc hiển thị ID tạm)
  const setupBtn = (btn, id, type) => {
    if (id) {
      btn.disabled = false;
      btn.onclick = () => window.loadSutta(id);
      // Tạm thời chỉ hiện ID ở tooltip, muốn hiện Title thì phải fetch meta của prev/next
      btn.title = `${type}: ${id.toUpperCase()}`; 
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
  container.innerHTML = UIFactory.createErrorHtml(suttaId);
  statusDiv.textContent = "Sutta not found.";
  statusDiv.classList.remove("hidden");
}

// [UPDATED] Hàm nhận data trực tiếp
export function renderSutta(suttaId, data, options = {}) {
  const container = document.getElementById("sutta-container");
  
  if (!data || !data.content) {
    handleNotFound(suttaId);
    return false;
  }

  // 1. Compile HTML
  // ContentCompiler cần được sửa để nhận raw JSON object thay vì lookup DB
  const htmlContent = ContentCompiler.compile(data.content, data.uid); 
  
  if (!htmlContent) return false;

  // 2. Navigation Logic
  // Dùng data.bookStructure để tính next/prev
  const nav = calculateNavigation(data.bookStructure, data.uid);
  
  // 3. Render
  updateTopNavDOM(data, nav.prev, nav.next);
  const bottomNavHtml = UIFactory.createBottomNavHtml(nav.prev, nav.next);
  
  container.innerHTML = htmlContent + bottomNavHtml;

  // 4. TOH
  if (!tohInstance) tohInstance = setupTableOfHeadings();
  tohInstance.generate();

  return true;
}