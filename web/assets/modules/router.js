// Path: web/assets/modules/router.js

export const Router = {
  updateURL: function (suttaId, bookParam, enableRandomMode = false) {
    try {
      const params = new URLSearchParams(window.location.search);
      // [NEW] Logic kiểm tra để giữ Hash
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

      // [FIX] Nếu đang ở cùng một bài kinh (ví dụ: reload trang), giữ lại hash
      // Nếu chuyển sang bài khác (suttaId != currentSuttaId), hash sẽ tự mất (để tránh scroll nhầm)
      let hash = "";
      if (suttaId === currentSuttaId && window.location.hash) {
          hash = window.location.hash;
      }

      const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
      const stateId = enableRandomMode ? null : suttaId || params.get("q");
      
      // Chỉ pushState nếu URL thực sự thay đổi để tránh rác history
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