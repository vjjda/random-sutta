// Path: web/assets/modules/router.js

export const Router = {
  updateURL: function (suttaId, bookParam, enableRandomMode = false, explicitHash = null) {
    try {
      const params = new URLSearchParams(window.location.search);
      const currentSuttaId = params.get("q");

      if (enableRandomMode) {
        params.set("r", "1");
        params.delete("q");
      } else if (suttaId) {
        params.set("q", suttaId);
        params.delete("r");
      }

      if (bookParam) {
        params.set("b", bookParam);
      } else {
        params.delete("b");
      }

      // [LOGIC HASH MỚI]
      let hash = "";
      if (explicitHash) {
          // 1. Nếu có hash mới từ hành động Search (ví dụ: mn5#1.2)
          hash = explicitHash.startsWith("#") ? explicitHash : `#${explicitHash}`;
      } else if (suttaId === currentSuttaId && window.location.hash) {
          // 2. Nếu đang Reload trang cũ, giữ lại hash cũ
          hash = window.location.hash;
      }
      // 3. Nếu chuyển trang mới mà không có explicitHash -> hash rỗng (Xóa hash cũ)

      const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
      const stateId = enableRandomMode ? null : suttaId || params.get("q");
      
      if (newUrl !== window.location.search + window.location.hash) {
         window.history.pushState({ suttaId: stateId }, "", newUrl);
      }
    } catch (e) {
      console.warn("Router Error:", e);
    }
  },

  getParams: function () {
    const p = new URLSearchParams(window.location.search);
    return {
      q: p.get("q"),
      r: p.get("r"),
      b: p.get("b"),
    };
  },
};