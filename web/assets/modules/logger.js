// Path: web/assets/modules/logger.js

/**
 * Enum for Log Levels
 */
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// Cấu hình mặc định
const Config = {
    level: LogLevel.INFO, // Mặc định chỉ hiện INFO trở lên
    showTimestamp: true
};

// Bảng màu cho Console (CSS styling)
const Styles = {
    base: "padding: 2px 4px; border-radius: 2px; font-weight: bold;",
    module: "color: #fff; background-color: #555;",
    [LogLevel.DEBUG]: "color: #888;", // Gray
    [LogLevel.INFO]: "color: #2e7d32;", // Green
    [LogLevel.WARN]: "color: #ef6c00;", // Orange
    [LogLevel.ERROR]: "color: #c62828; font-weight: bold;" // Red
};

const LevelLabels = {
    [LogLevel.DEBUG]: "DEBUG",
    [LogLevel.INFO]: "INFO ", // Space for alignment
    [LogLevel.WARN]: "WARN ",
    [LogLevel.ERROR]: "ERROR"
};

/**
 * Thiết lập cấu hình Global cho Logger
 * @param {object} options - { level: LogLevel.DEBUG }
 */
export function setupLogging(options = {}) {
    if (typeof options.level !== 'undefined') {
        Config.level = options.level;
    }
    if (typeof options.showTimestamp !== 'undefined') {
        Config.showTimestamp = options.showTimestamp;
    }
    
    // Log thông báo khởi tạo
    console.log(
        `%c [Logger] Initialized with level: ${Object.keys(LogLevel).find(key => LogLevel[key] === Config.level)}`, 
        "color: #1976d2; font-weight: bold;"
    );
}

/**
 * Factory tạo Logger cho từng Module
 * @param {string} name - Tên module (vd: "SuttaController")
 */
export function getLogger(name) {
    const print = (level, message, ...args) => {
        if (level < Config.level) return;

        const timestamp = Config.showTimestamp 
            ? `[${new Date().toLocaleTimeString('en-GB', { hour12: false })}]` 
            : "";
        
        const label = LevelLabels[level];
        const style = Styles[level];
        
        // Format: [TIME] [MODULE] LEVEL: Message
        // %c là directive để áp dụng CSS
        console.log(
            `%c${timestamp}%c[${name}]%c ${label}:`, 
            "color: #999; font-weight: normal;", // Timestamp style
            Styles.module,                       // Module name style
            style,                               // Level style
            message,
            ...args
        );
    };

    return {
        debug: (msg, ...args) => print(LogLevel.DEBUG, msg, ...args),
        info: (msg, ...args) => print(LogLevel.INFO, msg, ...args),
        warn: (msg, ...args) => print(LogLevel.WARN, msg, ...args),
        error: (msg, ...args) => print(LogLevel.ERROR, msg, ...args)
    };
}