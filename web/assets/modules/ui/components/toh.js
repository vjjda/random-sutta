// Path: web/assets/modules/ui/components/toh.js
import { Scroller } from '../common/scroller.js';

export function setupTableOfHeadings() {
    const wrapper = document.getElementById("toh-wrapper");
    const fab = document.getElementById("toh-fab");
    const menu = document.getElementById("toh-menu");
    const list = document.getElementById("toh-list");
    const container = document.getElementById("sutta-container");
    // Lấy header của menu để đổi tiêu đề nếu cần (Headings vs Paragraphs)
    const menuHeader = menu ? menu.querySelector(".toh-header") : null;

    if (!wrapper || !fab || !menu || !list || !container) {
        return { generate: () => {} };
    }

    // Toggle menu logic
    fab.onclick = (e) => {
        menu.classList.toggle("hidden");
        fab.classList.toggle("active");
        e.stopPropagation();
    };
    
    // Đóng menu khi click ra ngoài
    document.addEventListener("click", (e) => {
        if (!menu.classList.contains("hidden") && !wrapper.contains(e.target)) {
            menu.classList.add("hidden");
            fab.classList.remove("active");
        }
    });

    /**
     * Trích xuất số đoạn từ Segment ID.
     * Hỗ trợ cả số đơn (3) và phạm vi (9-15).
     * Ví dụ: "mn10:3.1" -> "3"
     * Ví dụ: "mn3:9-15.1" -> "9-15"
     */
    function extractParagraphNumber(segmentId) {
        if (!segmentId) return "";
        try {
            // Lấy phần sau dấu hai chấm (nếu có)
            const parts = segmentId.split(':');
            if (parts.length < 2) return ""; 
            
            const suffix = parts[1];
            // Lấy phần trước dấu chấm đầu tiên
            const numberOrRange = suffix.split('.')[0];
            
            // Regex: Chấp nhận số (3) hoặc phạm vi số (9-15)
            // ^\d+ : Bắt đầu bằng số
            // (-\d+)? : Có thể theo sau là dấu gạch ngang và số khác (không bắt buộc)
            // $ : Kết thúc chuỗi
            if (/^\d+(-\d+)?$/.test(numberOrRange)) {
                return numberOrRange;
            }
            return "";
        } catch (e) {
            return "";
        }
    }

    function createMenuItem(targetId, text, className, prefix = "") {
        const li = document.createElement("li");
        li.className = `toh-item ${className}`;
        
        const span = document.createElement("span"); 
        span.className = "toh-link";
        
        // Nếu có prefix (số đoạn), hiển thị đậm ở đầu
        if (prefix) {
            span.innerHTML = `<b>${prefix}.</b> ${text}`;
        } else {
            span.textContent = text;
        }
        
        span.onclick = () => {
            Scroller.animateScrollTo(targetId);
            menu.classList.add("hidden");
            fab.classList.remove("active");
        };

        li.appendChild(span);
        return li;
    }

    function renderHeadings(headings) {
        if (menuHeader) menuHeader.textContent = "Headings";
        
        headings.forEach((heading, index) => {
            if (!heading.id) {
                heading.id = `toh-heading-${index}`;
            }

            // Ưu tiên lấy text từ span .eng hoặc .pli để tránh lẫn lộn
            let labelText = heading.textContent;
            const engNode = heading.querySelector(".eng");
            const pliNode = heading.querySelector(".pli");
            
            if (engNode && engNode.textContent.trim()) {
                labelText = engNode.textContent.trim();
            } else if (pliNode && pliNode.textContent.trim()) {
                labelText = pliNode.textContent.trim();
            }
            
            labelText = labelText.replace(/\s+/g, ' ').trim();
            const levelClass = `toh-${heading.tagName.toLowerCase()}`;
            
            list.appendChild(createMenuItem(heading.id, labelText, levelClass));
        });
    }

    function renderParagraphs(segments) {
        if (menuHeader) menuHeader.textContent = "Paragraphs";

        segments.forEach(seg => {
            const id = seg.id;
            let paraNum = extractParagraphNumber(id);
            
            // [CHECK EVAM] Nếu là đoạn 'Evam' (Thus have I heard), bỏ số thứ tự
            if (seg.querySelector('.evam') || seg.closest('.evam')) {
                paraNum = "";
            }

            let labelText = "Paragraph";
            const engNode = seg.querySelector(".eng");
            const pliNode = seg.querySelector(".pli");

            // Ưu tiên tiếng Anh, fallback sang Pali
            if (engNode && engNode.textContent.trim()) {
                labelText = engNode.textContent.trim();
            } else if (pliNode && pliNode.textContent.trim()) {
                labelText = pliNode.textContent.trim();
            }

            // Cắt ngắn nếu quá dài (cho gọn menu)
            if (labelText.length > 60) {
                labelText = labelText.substring(0, 60) + "...";
            }

            // Dùng class 'toh-h3' để thụt lề nhẹ cho đẹp
            list.appendChild(createMenuItem(id, labelText, "toh-h3", paraNum));
        });
    }

    function generate() {
        list.innerHTML = "";
        menu.classList.add("hidden");
        fab.classList.remove("active");

        // 1. Chiến lược A: Tìm Heading cấu trúc (h2 trở lên)
        const structuralHeadings = container.querySelectorAll("h2, h3, h4, h5");

        if (structuralHeadings.length >= 2) {
            renderHeadings(structuralHeadings);
            wrapper.classList.remove("hidden");
        } else {
            // 2. Chiến lược B: Paragraph Scan (Fallback)
            const paragraphs = container.querySelectorAll("p");
            const validSegments = [];

            paragraphs.forEach(p => {
                // Lấy segment đầu tiên trong paragraph
                const firstSeg = p.querySelector(".segment");
                if (firstSeg && firstSeg.id) {
                    if (firstSeg.textContent.trim().length > 0) {
                        validSegments.push(firstSeg);
                    }
                }
            });

            if (validSegments.length > 2) {
                renderParagraphs(validSegments);
                wrapper.classList.remove("hidden");
            } else {
                wrapper.classList.add("hidden");
            }
        }
    }

    return { generate };
}