// Path: web/assets/modules/core/router.js

export const Router = {
  // [UPDATED] Thêm tham số thứ 5: savedScrollPosition (mặc định null)
  updateURL: function (suttaId, bookParam, enableRandomMode = false, explicitHash = null, savedScrollPosition = null) {
    // 1. [SAFEGUARD] Lưu vị trí cuộn
    try {
      // Logic: Ưu tiên lấy giá trị được truyền vào (chính xác hơn), 
      // nếu không có mới lấy window.scrollY (fallback)
      const currentScrollY = (savedScrollPosition !== null) ? savedScrollPosition : (window.scrollY || 0);
      
      const currentState = window.history.state || {};
      window.history.replaceState(
          { ...currentState, scrollY: currentScrollY }, 
          "", 
          window.location.href
      );
    } catch (e) {
      console.warn("Could not save scroll position:", e);
    }

    // 2. [MAIN LOGIC] Cập nhật URL
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

      let hash = "";
      if (explicitHash) {
          hash = explicitHash.startsWith("#") ? explicitHash : `#${explicitHash}`;
      } else if (suttaId === currentSuttaId && window.location.hash) {
          hash = window.location.hash;
      }

      const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
      const stateId = enableRandomMode ? null : suttaId || params.get("q");
      
      if (newUrl !== window.location.search + window.location.hash) {
         window.history.pushState({ suttaId: stateId, scrollY: 0 }, "", newUrl);
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