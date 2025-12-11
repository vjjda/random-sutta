// Path: web/assets/modules/ui/managers/theme_manager.js
export const ThemeManager = {
    init() {
        const btn = document.getElementById("btn-theme-toggle");
        const iconMoon = btn?.querySelector(".icon-moon");
        const iconSun = btn?.querySelector(".icon-sun");
        const label = document.getElementById("theme-label");

        // 1. Kiểm tra Preference đã lưu hoặc System Preference
        const storedTheme = localStorage.getItem("sutta_theme");
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        
        let currentTheme = storedTheme || (systemPrefersDark ? "dark" : "light");

        // Hàm apply
        const applyTheme = (theme) => {
            document.documentElement.setAttribute("data-theme", theme);
            localStorage.setItem("sutta_theme", theme);
            currentTheme = theme;
            
            // Update UI Button
            if (theme === "dark") {
                iconMoon.classList.add("hidden");
                iconSun.classList.remove("hidden");
                if (label) label.textContent = "Light Mode";
            } else {
                iconMoon.classList.remove("hidden");
                iconSun.classList.add("hidden");
                if (label) label.textContent = "Dark Mode";
            }
        };

        // Apply lần đầu
        applyTheme(currentTheme);

        // Sự kiện Click
        if (btn) {
            btn.addEventListener("click", () => {
                const newTheme = currentTheme === "light" ? "dark" : "light";
                applyTheme(newTheme);
            });
        }
    }
};