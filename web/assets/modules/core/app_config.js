// Path: web/assets/modules/core/app_config.js
export const AppConfig = {
    // Random & Buffer Strategy
    BUFFER_SIZE: 3, 
    INITIAL_PRELOAD_DELAY: 3000,
    IDLE_CALLBACK_TIMEOUT: 2000,
    
    // UI/UX
    TOAST_DURATION: 3000,
    MAGIC_NAV_COOLDOWN: 60000,

    // [UPDATED] TTS Configuration
    TTS: {
        // Khoảng cách từ mép trên màn hình đến đoạn văn đang đọc (Highlight)
        SCROLL_OFFSET_TOP: '15vh',

        // Khoảng trống đệm dưới cùng trang web
        BOTTOM_PADDING: '300px', 
        
        // [UPDATED] Chỉ cần voiceURI là đủ
        DEFAULT_VOICE: {
            voiceURI: "en-US-Chirp3-HD-Algenib"
        },

        // [NEW] Danh sách giọng đề xuất (Nằm top list)
        RECOMMENDED_VOICES: [
            { 
                voiceURI: "en-US-Chirp3-HD-Algenib", 
                name: "🇺🇸 Chirp 3 Algenib (Deep)" 
            },
            { 
                voiceURI: "en-US-Chirp3-HD-Puck", 
                name: "🇺🇸 Chirp 3 Puck (Clear)" 
            },
            { 
                voiceURI: "en-GB-Chirp3-HD-Orion", 
                name: "🇬🇧 Chirp 3 Orion (British)" 
            },
            { 
                voiceURI: "en-US-Neural2-D",
                name: "🇺🇸 Neural 2 D (Male)"
            },
            { 
                voiceURI: "en-US-Neural2-F",
                name: "🇺🇸 Neural 2 F (Female)"
            }
        ],
        
        // Số lượng câu/đoạn tải trước
        BUFFER_AHEAD: 7,

        // Ngưỡng ký tự để tự động chia nhỏ đoạn văn
        PARAGRAPH_SPLIT_THRESHOLD: 300
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
        "tts_rate",
        "tts_voice_uri",
        "tts_auto_next"
    ]
};