// Path: web/assets/modules/ui/views/renderers/leaf_renderer.js
import { ContentCompiler } from "../../../data/content_compiler.js";

function createContextFooter(currentUid, metaEntry, contextMeta) {
    if (!metaEntry || !metaEntry.parent_uid) return "";

    const parentId = metaEntry.parent_uid;
    const parentMeta = contextMeta[parentId] || {};
    
    const acronym = parentMeta.acronym || parentId.toUpperCase();
    const title = parentMeta.translated_title || parentMeta.original_title || "";
    // Kiểm tra xem title có trùng acronym không (tránh in lặp)
    const hasDistinctTitle = title && title.toLowerCase() !== acronym.toLowerCase();
    const targetId = metaEntry.extract_id || currentUid;
    const action = `window.loadSutta('${parentId}#${targetId}', true, 0, { transition: true })`;

    return `
        <div class="sutta-context-footer">
            <span class="ctx-label">See also</span>
            <button onclick="${action}" class="ctx-link">
                <span class="ctx-acronym">${acronym}</span>
                ${hasDistinctTitle ? `<span class="ctx-title">${title}</span>` : ''}
            </button>
        </div>
    `;
}

// [NEW] Helper: Ẩn Pali nếu nội dung trùng khớp hoàn toàn với tiếng Anh trong Heading
function cleanRedundantHeadings(htmlString) {
    // Tạo DOM ảo để thao tác
    const wrapper = document.createElement('div');
    wrapper.innerHTML = htmlString;

    // Chỉ quét các segment nằm trong thẻ Heading (h1-h6) hoặc class sutta-title
    const selectors = [
        'h1 .segment', 'h2 .segment', 'h3 .segment', 'h4 .segment', 'h5 .segment', 'h6 .segment',
        '.sutta-title .segment'
    ];
    
    const segments = wrapper.querySelectorAll(selectors.join(', '));

    segments.forEach(seg => {
        const pli = seg.querySelector('.pli');
        const eng = seg.querySelector('.eng');

        if (pli && eng) {
            const pliText = pli.textContent.trim();
            const engText = eng.textContent.trim();

            // So sánh nội dung (chấp nhận giống nhau về số hoặc text)
            // Thêm điều kiện length > 0 để tránh ẩn nếu rỗng
            if (pliText === engText && pliText.length > 0) {
                // Thêm class hidden (đã có trong _reset.css)
                pli.classList.add('hidden');
            }
        }
    });

    return wrapper.innerHTML;
}

function getDisplayInfo(uid, metaEntry) {
    let main = uid.toUpperCase();
    let sub = "";
    const match = uid.match(/^([a-z]+)(\d.*)$/i);
    if (match) main = `${match[1].toUpperCase()} ${match[2]}`;

    if (metaEntry) {
        main = metaEntry.acronym || main;
        sub = metaEntry.translated_title || metaEntry.original_title || "";
    }
    return { main, sub };
}

export const LeafRenderer = {
    render(data) {
        // 1. Compile nội dung thô
        let htmlContent = ContentCompiler.compile(data.content, data.uid);
        
        // 2. [NEW] Làm sạch các heading bị lặp Pali/Eng
        htmlContent = cleanRedundantHeadings(htmlContent);

        // 3. Tạo Footer điều hướng ngữ cảnh
        const footerHtml = createContextFooter(data.uid, data.meta, data.contextMeta);
        if (footerHtml) {
            htmlContent = htmlContent + footerHtml;
        }

        const displayInfo = getDisplayInfo(data.uid, data.meta);

        return {
            html: htmlContent,
            displayInfo: displayInfo
        };
    }
};