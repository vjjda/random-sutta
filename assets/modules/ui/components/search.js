// Path: web/assets/modules/ui/components/search.js

export function setupQuickNav(onSearchCallback) {
  const displayContainer = document.getElementById("nav-title-display");
  const textMode = document.getElementById("nav-title-text");
  const inputMode = document.getElementById("nav-search-container");
  const inputField = document.getElementById("nav-sutta-input");
  const goBtn = document.getElementById("nav-search-btn");

  if (!displayContainer || !textMode || !inputMode) return null;

  function activateSearchMode() {
      textMode.classList.add("hidden");
      inputMode.classList.remove("hidden");
      inputField.value = ""; 
      inputField.focus();
  }

  function cancelSearch() {
    inputMode.classList.add("hidden");
    textMode.classList.remove("hidden");
  }

  // Chuyển sang Input Mode khi click vào tiêu đề
  displayContainer.addEventListener("click", (e) => {
    if (e.target === inputField || e.target === goBtn || inputMode.contains(e.target)) {
      return;
    }
    activateSearchMode();
  });

  const performSearch = () => {
    const query = inputField.value.trim().toLowerCase().replace(/\s/g, "");
    if (!query) {
      cancelSearch();
      return;
    }
    // Gọi callback (thường là SuttaController.loadSutta)
    if (onSearchCallback) onSearchCallback(query);
    cancelSearch();
  };

  goBtn.addEventListener("click", performSearch);

  inputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter") performSearch();
    if (e.key === "Escape") {
      cancelSearch();
      e.stopPropagation();
    }
  });

  // Tự đóng khi mất focus
  inputField.addEventListener("blur", (e) => {
    setTimeout(() => {
      if (!inputMode.contains(document.activeElement)) {
        cancelSearch();
      }
    }, 150);
  });

  return { activateSearchMode };
}