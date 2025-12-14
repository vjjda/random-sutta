// Path: web/assets/modules/core/router.js

export const Router = {
  // Giữ nguyên tham số enableRandomMode để tránh lỗi gọi hàm, nhưng sẽ ignore nó trong logic
  updateURL: function (suttaId, bookParam, enableRandomMode = false, explicitHash = null, savedScrollPosition = null) {
    // 1. Save Scroll Position for CURRENT state before navigating/updating
    try {
      const currentScrollY = (savedScrollPosition !== null) ? savedScrollPosition : (window.scrollY || 0);
      
      const currentState = window.history.state || {};
      
      // [CRITICAL FIX] Đảm bảo không làm mất popupSnapshot nếu nó đang tồn tại trong state hiện tại
      // Khi loadSutta gọi updateURL, nó thực hiện replaceState để lưu scroll.
      // Cần chắc chắn ...currentState bao gồm cả popupSnapshot.
      window.history.replaceState(
          { ...currentState, scrollY: currentScrollY }, 
          "", 
          window.location.href
      );
    } catch (e) {
      console.warn("Could not save scroll position:", e);
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const currentSuttaId = params.get("q");

      // 1. Luôn xóa cờ 'r' để làm sạch URL
      params.delete("r");
      // 2. Luôn set 'q' nếu có suttaId
      if (suttaId) {
        params.set("q", suttaId);
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
      const stateId = suttaId || params.get("q");

      // [UPDATED] Normalized comparison to avoid duplicate pushes
      const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      
      if (newUrl !== currentRelativeUrl) {
         // Push new state (Clean state for new page)
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