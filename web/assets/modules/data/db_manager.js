// Path: web/assets/modules/data/db_manager.js
import { calculateNavigation } from "../ui/navigator.js"; // [NEW] Import logic

export const DB = {
  // ... (findBookContaining, getMeta GIỮ NGUYÊN) ...
  findBookContaining: function (suttaId) {
    if (!window.SUTTA_DB) return null;
    for (const bookKey in window.SUTTA_DB) {
      const book = window.SUTTA_DB[bookKey];
      if (
        (book.content &&
          Object.prototype.hasOwnProperty.call(book.content, suttaId)) ||
        (book.meta && Object.prototype.hasOwnProperty.call(book.meta, suttaId))
      ) {
        return book;
      }
    }
    return null;
  },

  getMeta: function (id) {
    const book = this.findBookContaining(id);
    if (book && book.meta && book.meta[id]) return book.meta[id];
    if (window.SUTTA_DB) {
      for (const bookKey in window.SUTTA_DB) {
        const b = window.SUTTA_DB[bookKey];
        if (b.meta && b.meta[id]) return b.meta[id];
      }
    }
    return null;
  },



  // [REFACTORED] Hàm điều hướng giờ gọi sang Module Navigator
  getNavigation: function (suttaId) {
    const book = this.findBookContaining(suttaId);
    if (!book || !book.structure) return { next: null, prev: null };

    // Ủy quyền tính toán cho Navigator
    return calculateNavigation(book.structure, suttaId);
  },

  getAllAvailableSuttas: function () {
    // (Giữ nguyên)
    if (!window.SUTTA_DB) return [];
    let allSuttas = [];
    for (const bookKey in window.SUTTA_DB) {
      const book = window.SUTTA_DB[bookKey];
      if (book.content) {
        allSuttas = allSuttas.concat(Object.keys(book.content));
      }
    }
    return allSuttas;
  },
};
