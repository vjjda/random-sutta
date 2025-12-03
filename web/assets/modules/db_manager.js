// Path: web/assets/modules/db_manager.js

window.DB = {
  /**
   * Tìm cuốn sách chứa suttaId cụ thể.
   * Vì DB mới tổ chức theo sách (sutta_mn, sutta_dn...), ta phải duyệt qua các sách đã load.
   */
  findBookContaining: function (suttaId) {
    if (!window.SUTTA_DB) return null;
    
    // Duyệt qua từng key sách (ví dụ: 'sutta_mn', 'vinaya_pli-tv-bi-pm')
    for (const bookKey in window.SUTTA_DB) {
      const book = window.SUTTA_DB[bookKey];
      // Kiểm tra xem ID bài kinh có trong phần content của sách không
      if (book.content && Object.prototype.hasOwnProperty.call(book.content, suttaId)) {
        return book;
      }
    }
    return null;
  },

  /**
   * Lấy Metadata của một bài kinh hoặc một node (dựa trên ID).
   */
  getMeta: function (id) {
    // 1. Thử tìm trong các sách đã load
    const book = this.findBookContaining(id);
    if (book && book.meta && book.meta[id]) {
      return book.meta[id];
    }
    
    // 2. Fallback: Nếu ID là ID của sách (ví dụ 'mn'), tìm trong chính sách đó
    // (Logic này xử lý trường hợp id trùng với tên sách hoặc group)
    if (window.SUTTA_DB) {
      // Thử tìm trực tiếp key sách (với prefix có thể có)
      for (const bookKey in window.SUTTA_DB) {
        const b = window.SUTTA_DB[bookKey];
        if (b.meta && b.meta[id]) return b.meta[id];
      }
    }
    
    return null;
  },

  /**
   * Lắp ráp HTML từ dữ liệu segments thô.
   * Chuyển đổi từ JSON segments -> HTML string hoàn chỉnh.
   */
  compileHtml: function (suttaId) {
    const book = this.findBookContaining(suttaId);
    if (!book) return null;

    const segments = book.content[suttaId];
    if (!segments) return null;

    let fullHtml = "";

    // Lấy danh sách segment ID (ví dụ: ["mn20:0.1", "mn20:0.2", ...])
    // Sắp xếp tự nhiên để đảm bảo thứ tự (dù Python đã sort, JS object order không đảm bảo 100%)
    const segmentIds = Object.keys(segments).sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    segmentIds.forEach((segId) => {
      const seg = segments[segId];
      // segId dạng "mn20:1.1", ta chỉ cần "1.1" cho HTML id để gọn và khớp CSS cũ
      const shortId = segId.includes(':') ? segId.split(':')[1] : segId;

      // Xây dựng nội dung bên trong <span> segment
      let contentInner = "";
      
      // 1. Pali
      if (seg.pli) {
        contentInner += `<span class='pli'>${seg.pli}</span>`;
      }
      
      // 2. English
      if (seg.eng) {
        contentInner += `<span class='eng'>${seg.eng}</span>`;
      }
      
      // 3. Comment (Chú giải)
      if (seg.comm) {
         // Escape dấu nháy đơn để an toàn khi đưa vào data attribute
         const safeComm = seg.comm.replace(/'/g, "&#39;");
         contentInner += `<span class='comment-marker' data-comment='${safeComm}'>*</span>`;
      }

      // Tạo thẻ bao segment
      const segmentWrapper = `<span class='segment' id='${shortId}'>${contentInner}</span>`;

      // Inject vào Template HTML từ dữ liệu
      // Template ví dụ: "<p>{}" hoặc "<h1 class='title'>{}</h1>" hoặc chỉ "{}"
      if (seg.html) {
          fullHtml += seg.html.replace("{}", segmentWrapper) + "\n";
      } else {
          // Fallback nếu thiếu html template
          fullHtml += `<p>${segmentWrapper}</p>\n`;
      }
    });

    // Bọc toàn bộ trong thẻ article
    return `<article id='${suttaId}'>${fullHtml}</article>`;
  },

  /**
   * Tính toán bài trước/bài sau dựa trên cấu trúc cây (structure).
   */
  getNavigation: function (suttaId) {
    const book = this.findBookContaining(suttaId);
    if (!book || !book.structure) return { next: null, prev: null };

    // Làm phẳng cấu trúc cây thành 1 danh sách duy nhất để tìm index
    const flatList = this._flattenStructure(book.structure);
    const idx = flatList.indexOf(suttaId);

    if (idx === -1) return { next: null, prev: null };

    return {
      prev: idx > 0 ? flatList[idx - 1] : null,
      next: idx < flatList.length - 1 ? flatList[idx + 1] : null
    };
  },

  /**
   * Helper: Đệ quy làm phẳng cây structure thành mảng các ID string.
   */
  _flattenStructure: function (node, list = []) {
    if (typeof node === 'string') {
        list.push(node);
    } else if (Array.isArray(node)) {
      node.forEach(child => this._flattenStructure(child, list));
    } else if (typeof node === 'object' && node !== null) {
      Object.values(node).forEach(child => this._flattenStructure(child, list));
    }
    return list;
  },

  /**
   * Lấy danh sách TẤT CẢ các ID bài kinh đang có trong bộ nhớ (đã load).
   * Dùng cho chức năng Random.
   */
  getAllAvailableSuttas: function() {
      if (!window.SUTTA_DB) return [];
      let allSuttas = [];
      for (const bookKey in window.SUTTA_DB) {
          const book = window.SUTTA_DB[bookKey];
          if (book.content) {
              allSuttas = allSuttas.concat(Object.keys(book.content));
          }
      }
      return allSuttas;
  }
};