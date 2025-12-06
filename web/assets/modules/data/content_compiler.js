// Path: web/assets/modules/data/content_compiler.js

export const ContentCompiler = {
  // [UPDATED] Nhận content object (chunk) trực tiếp
  compile: function (contentData, rootId) {
    if (!contentData) return "";

    let html = "";
    
    // Sort keys (vì JSON object không đảm bảo thứ tự, dù Python đã sort)
    // Keys dạng: mn1:0.1, mn1:1.1 ...
    const sortedKeys = Object.keys(contentData).sort((a, b) => {
        // Logic sort tự nhiên (alphanumeric)
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedKeys.forEach((segmentId) => {
      const segment = contentData[segmentId];
      if (!segment) return;

      let text = "";
      // Ưu tiên HTML có sẵn (headings, evams)
      if (segment.html) {
        text = segment.html.replace("{}", segment.eng || "");
      } else {
        // Segment thường
        const pali = segment.pli ? `<span class='pli'>${segment.pli}</span>` : "";
        const eng = segment.eng ? `<span class='eng'>${segment.eng}</span>` : "";
        text = `<p class='segment' id='${segmentId}'>${pali}${eng}`;
        
        // Thêm comment marker nếu có
        if (segment.comm) {
            // Escape single quotes for HTML attribute
            const safeComm = segment.comm.replace(/'/g, "&apos;");
            text += `<span class='comment-marker' data-comment='${safeComm}'>*</span>`;
        }
        text += "</p>";
      }
      html += text;
    });

    return html;
  },
  
  // Có thể bỏ compileBranchHtml nếu Branch giờ đây cũng dùng chunk
  // Hoặc giữ lại nếu muốn render thông tin từ Meta của Branch
};