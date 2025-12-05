// Path: web/assets/modules/utils.js
import { DB } from './db_manager.js';

/**
 * Lấy thông tin hiển thị (Tiêu đề, Subtitle) cho một Sutta ID.
 * Dùng cho Header và các nút điều hướng.
 */
export function getSuttaDisplayInfo(suttaId) {
    const id = suttaId.toLowerCase();
    const meta = DB.getMeta(id);
    
    if (meta) {
        return {
            // [UPDATED] Main: Acronym -> Sutta ID
            title: meta.acronym || id,
            // [UPDATED] Sub: Translated Title -> Original Title
            subtitle: meta.translated_title || meta.original_title || ""
        };
    }
    
    // Fallback nếu chưa load được meta
    return {
        title: id,
        subtitle: ""
    };
}

/**
 * Khởi tạo logic cho Popup chú giải (Comment).
 */
export function initCommentPopup() {
    const popup = document.getElementById("comment-popup");
    const content = document.getElementById("comment-content");
    const closeBtn = document.getElementById("close-comment");
    const container = document.getElementById("sutta-container");

    function showComment(text) {
        content.innerHTML = text;
        popup.classList.remove("hidden");
    }

    function hideComment() {
        popup.classList.add("hidden");
    }
    
    // 1. Click vào dấu hoa thị (*) để hiện popup
    container.addEventListener("click", (event) => {
        if (event.target.classList.contains("comment-marker")) {
            const text = event.target.dataset.comment;
            if (text) {
                showComment(text);
                event.stopPropagation();
            }
        } else {
            // Click ra ngoài thì đóng popup
            hideComment();
        }
    });

    // 2. Click vào link bên trong popup
    // Logic: Nếu là link nội bộ (có ?q=...), load sutta đó ngay lập tức
    content.addEventListener("click", (event) => {
        const link = event.target.closest("a");
        if (link) {
            const urlObj = new URL(link.href);
            
            // Kiểm tra xem có phải link nội bộ không
            if (urlObj.searchParams.has("q")) {
                event.preventDefault();
                
                let suttaId = urlObj.searchParams.get("q");
                const urlHash = urlObj.hash; 

                // Ghép hash vào ID nếu có (ví dụ: an1.1 + #an1.3 -> an1.1#an1.3)
                if (suttaId && urlHash) {
                    suttaId += urlHash; 
                }
                
                if (suttaId && window.loadSutta) {
                    hideComment();
                    
                    // [UPDATED] Load trực tiếp (Direct Jump)
                    // Không truyền { transition: true } để tránh hiệu ứng chuyển động text
                    window.loadSutta(suttaId, true, 0);
                }
            }
        }
    });

    // 3. Nút đóng popup
    closeBtn.addEventListener("click", (e) => {
        hideComment();
        e.stopPropagation();
    });

    // 4. Phím Escape để đóng
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideComment();
    });

    return { hideComment };
}