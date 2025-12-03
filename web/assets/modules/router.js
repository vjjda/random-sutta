// Path: web/assets/modules/router.js

export const Router = {
  updateURL: function (suttaId, bookParam, enableRandomMode = false) {
    try {
      const params = new URLSearchParams(window.location.search);
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

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      const stateId = enableRandomMode ? null : suttaId || params.get("q");
      window.history.pushState({ suttaId: stateId }, "", newUrl);
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