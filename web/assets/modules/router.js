// Path: web/assets/modules/router.js

export const Router = {
  updateURL: function (suttaId, bookParam, enableRandomMode = false, explicitHash = null) {
    // 1. [SAFEGUARD] Cố gắng lưu vị trí cuộn (Scroll Position)
    // Đặt trong try-catch riêng để không ảnh hưởng luồng chính
    try {
      const currentScrollY = window.scrollY || 0;
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

      // Xử lý Hash
      let hash = "";
      if (explicitHash) {
          hash = explicitHash.startsWith("#") ? explicitHash : `#${explicitHash}`;
      } else if (suttaId === currentSuttaId && window.location.hash) {
          hash = window.location.hash;
      }

      const newUrl = `${window.location.pathname}?${params.toString()}${hash}`;
      const stateId = enableRandomMode ? null : suttaId || params.get("q");
      
      // Chỉ pushState nếu URL thực sự thay đổi
      if (newUrl !== window.location.search + window.location.hash) {
         // Reset scrollY về 0 cho trang mới
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