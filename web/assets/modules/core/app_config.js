// Path: web/assets/modules/core/app_config.js
export const AppConfig = {
    // Random & Buffer Strategy
    BUFFER_SIZE: 3, 
    INITIAL_PRELOAD_DELAY: 3000,
    IDLE_CALLBACK_TIMEOUT: 2000,
    
    // UI/UX
    TOAST_DURATION: 3000,
    MAGIC_NAV_COOLDOWN: 60000,

    // [NEW] TTS Configuration
    TTS: {
        // Khoảng trống đệm dưới cùng để Player không che chữ (CSS value)
        BOTTOM_PADDING: "120px", 
        
        // Bật/Tắt tính năng kích hoạt bằng cách double-tap vào Nav Title
        ENABLE_NAV_DOUBLE_TAP: true 
    },

    // Popup Layout Configuration
    POPUP_LAYOUT: {
        COMMENT_HEIGHT_VH: 40, 
        QUICKLOOK_TOP_OFFSET_PX: 0 
    },

    // Sepia / Night Shift Configuration
    SEPIA: {
        MAX_CSS_LIGHT: 50,
        MAX_CSS_DARK: 100,
        HUE_COEFF: -0.25, 
        SATURATE: 1.0,
        STORAGE_KEY_PREFIX: "sutta_sepia_"
    },

    // Persistent Settings
    PERSISTENT_SETTINGS: [
        "sutta_theme",
        "sutta_font_scale",
        "sutta_sepia_light",
        "sutta_sepia_dark",
        // [NEW] Add TTS settings persistence if needed
        "tts_rate",
        "tts_voice_uri",
        "tts_auto_next"
    ]
};