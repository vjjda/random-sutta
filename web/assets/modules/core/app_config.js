// Path: web/assets/modules/core/app_config.js
export const AppConfig = {
    // Random & Buffer Strategy
    BUFFER_SIZE: 3, 
    INITIAL_PRELOAD_DELAY: 3000,
    IDLE_CALLBACK_TIMEOUT: 2000,
    
    // UI/UX
    TOAST_DURATION: 3000,
    MAGIC_NAV_COOLDOWN: 60000,

    // [UPDATED] Sepia / Night Shift Configuration
    SEPIA: {
        MAX_CSS_LIGHT: 50,
        MAX_CSS_DARK: 100,
        
        // [NEW] Cấu hình màu ấm (Night Shift)
        // Hệ số xoay màu (Hue Rotate): 
        // -0.5 là mức cam vừa phải. -1.0 sẽ rất đỏ. 0 là vàng chanh (sepia gốc).
        HUE_COEFF: -0.25, 
        
        // Độ bão hòa (Saturate):
        // 1.0 là bình thường. >1.0 giúp màu cam rực rỡ hơn, chữ đen rõ hơn.
        SATURATE: 1.0,

        STORAGE_KEY_PREFIX: "sutta_sepia_"
    },

    // Persistent Settings
    PERSISTENT_SETTINGS: [
        "sutta_theme",
        "sutta_font_scale",
        "sutta_sepia_light",
        "sutta_sepia_dark"
    ]
};