// Path: web/assets/modules/core/app_config.js
export const AppConfig = {
    // ... (Giữ nguyên các config cũ)
    BUFFER_SIZE: 3, 
    INITIAL_PRELOAD_DELAY: 3000,
    IDLE_CALLBACK_TIMEOUT: 2000,
    TOAST_DURATION: 3000,
    MAGIC_NAV_COOLDOWN: 60000,

    // Cấu hình Sepia (Đã thêm ở bước trước)
    SEPIA: {
        MAX_CSS_LIGHT: 40,
        MAX_CSS_DARK: 100,
        STORAGE_KEY_PREFIX: "sutta_sepia_"
    },

    // [NEW] Danh sách các Key trong LocalStorage cần được BẢO VỆ khi Reset
    PERSISTENT_SETTINGS: [
        "sutta_theme",          // Theme Manager
        "sutta_font_scale",     // Font Size Manager
        "sutta_sepia_light",    // Sepia Light
        "sutta_sepia_dark"      // Sepia Dark
    ]
};