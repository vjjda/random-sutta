// Path: web/assets/modules/ui/managers/theme_manager.js
import { AppConfig } from 'core/app_config.js';
import { getLogger } from 'utils/logger.js';

const logger = getLogger("ThemeManager");

export const ThemeManager = {
    CONFIG: {
        STORAGE_KEY_THEME: "sutta_theme",
    },

    init() {
        const btn = document.getElementById("btn-theme-toggle");
        const iconMoon = btn?.querySelector(".icon-moon");
        const iconSun = btn?.querySelector(".icon-sun");
        
        const sepiaPanel = document.getElementById("sepia-control-panel");
        const sepiaSlider = document.getElementById("sepia-slider");

        // [NEW] Inject Config vào CSS Root Variables
        // Giúp CSS calc() sử dụng được các thông số từ app_config.js
        document.documentElement.style.setProperty('--sepia-hue-coeff', AppConfig.SEPIA.HUE_COEFF);
        document.documentElement.style.setProperty('--sepia-saturate', AppConfig.SEPIA.SATURATE);

        // 1. Load Initial State
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const storedTheme = localStorage.getItem(this.CONFIG.STORAGE_KEY_THEME);
        
        let currentTheme = storedTheme || (systemPrefersDark ? "dark" : "light");

        // --- Helpers ---

        const getSepiaStorageKey = (theme) => `${AppConfig.SEPIA.STORAGE_KEY_PREFIX}${theme}`;

        const sliderToCss = (sliderValue, theme) => {
            const maxCss = theme === 'dark' 
                ? AppConfig.SEPIA.MAX_CSS_DARK 
                : AppConfig.SEPIA.MAX_CSS_LIGHT;
            return (sliderValue / 100) * maxCss;
        };

        const updateSepiaVisuals = (sliderValue, theme) => {
            const cssValue = sliderToCss(sliderValue, theme);
            
            // Truyền giá trị thô (unitless) để CSS tự tính toán
            document.documentElement.style.setProperty('--sepia-val', cssValue);
            
            if (sepiaSlider && sepiaSlider.value != sliderValue) {
                sepiaSlider.value = sliderValue;
            }
        };

        const applyTheme = (theme) => {
            document.documentElement.setAttribute("data-theme", theme);
            localStorage.setItem(this.CONFIG.STORAGE_KEY_THEME, theme);
            currentTheme = theme;
            
            if (theme === "dark") {
                iconMoon?.classList.add("hidden");
                iconSun?.classList.remove("hidden");
            } else {
                iconMoon?.classList.remove("hidden");
                iconSun?.classList.add("hidden");
            }

            const savedSepia = localStorage.getItem(getSepiaStorageKey(theme)) || 0;
            updateSepiaVisuals(savedSepia, theme);
        };

        // --- Init Run ---
        applyTheme(currentTheme);

        // --- Event Listeners ---
        if (btn) {
            let lastTapTime = 0;
            let clickTimer = null;
            let globalLastTouchTime = 0;

            const handleAction = (e) => {
                const now = Date.now();
                if (e.type === 'mousedown' && (now - globalLastTouchTime < 800)) return;
                if (e.type === 'touchstart') globalLastTouchTime = now;
                
                if (e.cancelable && e.type !== 'mousedown') e.preventDefault();

                const timeDiff = now - lastTapTime;
                
                if (timeDiff < 300 && timeDiff > 50) {
                    if (clickTimer) clearTimeout(clickTimer);
                    if (sepiaPanel) {
                        sepiaPanel.classList.toggle("hidden");
                        logger.info("Gesture", "Double tap -> Toggle Sepia Panel");
                    }
                    lastTapTime = 0;
                } else {
                    lastTapTime = now;
                    clickTimer = setTimeout(() => {
                        const newTheme = currentTheme === "light" ? "dark" : "light";
                        applyTheme(newTheme);
                        if (sepiaPanel && !sepiaPanel.classList.contains("hidden")) {
                            sepiaPanel.classList.add("hidden");
                        }
                    }, 300);
                }
            };

            btn.addEventListener("mousedown", handleAction);
            btn.addEventListener("touchstart", handleAction, { passive: false });
            btn.addEventListener("click", (e) => e.preventDefault());
        }

        if (sepiaSlider) {
            sepiaSlider.addEventListener("input", (e) => {
                const val = e.target.value;
                updateSepiaVisuals(val, currentTheme);
                localStorage.setItem(getSepiaStorageKey(currentTheme), val);
            });

            document.addEventListener("click", (e) => {
                if (!sepiaPanel.classList.contains("hidden") && 
                    !sepiaPanel.contains(e.target) && 
                    !btn.contains(e.target)) {
                    sepiaPanel.classList.add("hidden");
                }
            });
        }
    }
};