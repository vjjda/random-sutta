// Path: web/assets/modules/ui/views/renderer.js
import { ContentCompiler } from "../../data/content_compiler.js"; 
import { setupTableOfHeadings } from "../components/toh.js";
import { UIFactory } from "../common/ui_factory.js";

let tohInstance = null;

/**
 * Trích xuất thông tin hiển thị (Title, Subtitle) từ Meta hoặc ID.
 */
function getDisplayInfo(uid, metaEntry) {
    // Default
    let main = uid.toUpperCase();
    let sub = "";

    // Parse ID (vd: mn1 -> MN 1) nếu không có meta
    const match = uid.match(/^([a-z]+)(\d.*)$/i);
    if (match) main = `${match[1].toUpperCase()} ${match[2]}`;

    if (metaEntry) {
        main = metaEntry.acronym || main;
        sub = metaEntry.translated_title || metaEntry.original_title || "";
    }

    return { main, sub };
}

/**
 * Cập nhật Header thanh điều hướng (Trên cùng).
 */
function updateTopNavDOM(data, prevId, nextId) {
    const navHeader = document.getElementById("nav-header");
    const navMainTitle = document.getElementById("nav-main-title");
    const navSubTitle = document.getElementById("nav-sub-title");
    const statusDiv = document.getElementById("status");

    // 1. Hiển thị Title
    const currentInfo = getDisplayInfo(data.uid, data.meta);
    if (navMainTitle) navMainTitle.textContent = currentInfo.main;
    if (navSubTitle) navSubTitle.textContent = currentInfo.sub;

    document.getElementById("nav-title-text")?.classList.remove("hidden");
    document.getElementById("nav-search-container")?.classList.add("hidden");

    // 2. Cấu hình nút Prev/Next trên Header (Mũi tên nhỏ)
    const setupBtn = (btnId, targetId, type) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        if (targetId) {
            btn.disabled = false;
            btn.onclick = () => window.loadSutta(targetId);
            
            // Tooltip thông minh (hiển thị tên bài kế tiếp)
            // Dữ liệu lấy từ data.navMeta (đã được Service load sẵn)
            const neighborMeta = data.navMeta ? data.navMeta[targetId] : null;
            const neighborInfo = getDisplayInfo(targetId, neighborMeta);
            
            let tooltip = `${type}: ${neighborInfo.main}`;
            if (neighborInfo.sub) tooltip += ` - ${neighborInfo.sub}`;
            btn.title = tooltip;
        } else {
            btn.disabled = true;
            btn.onclick = null;
            btn.title = "End of list";
        }
    };

    setupBtn("nav-prev", prevId, "Previous");
    setupBtn("nav-next", nextId, "Next");

    if (navHeader) navHeader.classList.remove("hidden");
    if (statusDiv) statusDiv.classList.add("hidden");
}

function handleNotFound(suttaId) {
    const container = document.getElementById("sutta-container");
    const statusDiv = document.getElementById("status");
    if (container) container.innerHTML = UIFactory.createErrorHtml(suttaId);
    if (statusDiv) {
        statusDiv.textContent = "Sutta not found.";
        statusDiv.classList.remove("hidden");
    }
}

/**
 * Hàm Render chính.
 */
export async function renderSutta(suttaId, data, options = {}) {
    const container = document.getElementById("sutta-container");
    
    if (!data) {
        handleNotFound(suttaId);
        return false;
    }

    container.innerHTML = "";
    let htmlContent = "";
    
    // Lấy thông tin Nav từ Data (Backend đã tính sẵn)
    // Fallback sang object rỗng nếu không có
    const nav = data.nav || {}; 
    const prevId = nav.prev || null;
    const nextId = nav.next || null;

    // --- CASE 1: BRANCH / MENU (Mục lục) ---
    // Điều kiện: Có structure nhưng không có content text
    if (data.bookStructure && !data.content) {
        // Render cây thư mục
        // data.meta ở đây là meta của chính node đó (vd: an1)
        // Nhưng compileBranch cần map meta của các con.
        // TRONG SERVICE MỚI: data.meta chứa thông tin của node hiện tại.
        // Để render list con đẹp, ta cần meta của con.
        // Hiện tại: Service trả về `data.meta` là Object meta của Single Item.
        // TUY NHIÊN: File meta JSON (vd an1.json) chứa `meta` là Dict của TẤT CẢ con cái.
        // Service nên trả về cái Dict đó trong một trường khác, ví dụ `data.fullMeta` hoặc `data.contextMeta`.
        
        // [QUICK FIX for Branch Rendering]
        // Giả sử data.contextMeta chứa toàn bộ meta map của file json đó.
        htmlContent = ContentCompiler.compileBranch(data.bookStructure, data.uid, data.contextMeta || {});
        
        // Ẩn TOH floating button (không cần cho menu)
        document.getElementById("toh-wrapper")?.classList.add("hidden");
    } 
    
    // --- CASE 2: LEAF (Nội dung bài kinh) ---
    else if (data.content) {
        // Render văn bản
        htmlContent = ContentCompiler.compile(data.content, data.uid);
        
        // Thêm Title H1 vào đầu bài cho đẹp (nếu chưa có trong content)
        const info = getDisplayInfo(data.uid, data.meta);
        const headerHtml = `
            <header>
                <h1 class="sutta-title">
                    <span class="acronym">${info.main}</span>
                    <span class="translated-title">${info.sub}</span>
                </h1>
            </header>
        `;
        htmlContent = headerHtml + htmlContent;
    } 
    
    else {
        handleNotFound(suttaId);
        return false;
    }

    // --- FOOTER NAV ---
    // Tạo nút Prev/Next/Random ở dưới cùng
    const bottomNavHtml = UIFactory.createBottomNavHtml(
        prevId, 
        nextId, 
        data.navMeta || {} // Map meta của các bài lân cận
    );
    
    container.innerHTML = htmlContent + bottomNavHtml;
    
    // --- UPDATE HEADER ---
    updateTopNavDOM(data, prevId, nextId);

    // --- RE-INIT TOH (Mục lục nội bộ bài kinh) ---
    if (data.content) {
        if (!tohInstance) tohInstance = setupTableOfHeadings();
        tohInstance.generate();
    }

    return true;
}