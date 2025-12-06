// Path: web/assets/modules/data/content_compiler.js

export const ContentCompiler = {
  compile: function (contentData, rootId) {
    if (!contentData) return "";

    let html = "";
    
    // Sắp xếp keys để đảm bảo thứ tự đoạn văn
    const sortedKeys = Object.keys(contentData).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedKeys.forEach((segmentId) => {
      const segment = contentData[segmentId];
      if (!segment) return;

      // 1. Chuẩn bị nội dung song ngữ
      // Chỉ tạo thẻ span nếu có nội dung
      const pliText = segment.pli ? `<span class='pli'>${segment.pli}</span>` : "";
      const engText = segment.eng ? `<span class='eng'>${segment.eng}</span>` : "";
      
      // Nội dung hỗn hợp (Pali trước, Anh sau - CSS sẽ lo việc xuống dòng nhờ display: block)
      const combinedText = `${pliText}${engText}`;

      let text = "";

      // 2. Render
      // CASE A: Segment là Heading/Structure (có field html chứa placeholder {})
      if (segment.html) {
        // [FIX] Thay thế {} bằng cả Pali lẫn Anh
        text = segment.html.replace("{}", combinedText);
      } 
      // CASE B: Segment nội dung thông thường (tự bọc thẻ p)
      else {
        text = `<p class='segment' id='${segmentId}'>${combinedText}`;
        
        // Xử lý Comment
        if (segment.comm) {
            const safeComm = segment.comm.replace(/"/g, '&quot;').replace(/'/g, "&apos;");
            text += `<span class='comment-marker' data-comment="${safeComm}">*</span>`;
        }
        text += "</p>";
      }
      html += text;
    });

    return html;
  }
};