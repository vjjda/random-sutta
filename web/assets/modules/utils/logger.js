// Path: web/assets/modules/utils/logger.js

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
const Config = {
    level: LogLevel.INFO,
};

const Styles = {
    level: {
        [LogLevel.DEBUG]: "color: #9e9e9e;", // Grey
        [LogLevel.INFO]: "color: #4caf50;",  // Green
        [LogLevel.WARN]: "color: #ff9800;",  // Orange
        [LogLevel.ERROR]: "color: #f44336; font-weight: bold;", // Red
    },
    module: "color: #fff; background-color: #607d8b; padding: 2px 5px; border-radius: 2px;",
    context: "color: #b0bec5;",
    message: ""
};
const LevelLabels = {
    [LogLevel.DEBUG]: "DEBUG",
    [LogLevel.INFO]: "INFO ",
    [LogLevel.WARN]: "WARN ",
    [LogLevel.ERROR]: "ERROR"
};
export function setupLogging(options = {}) {
    if (typeof options.level !== 'undefined') {
        Config.level = options.level;
    }
    console.log(
        `%cLOGGER%c Initialized with level: ${Object.keys(LogLevel).find(key => LogLevel[key] === Config.level)}`,
        Styles.module, "font-weight: bold; color: #1976d2;"
    );
}

export function getLogger(moduleName) {
    const print = (level, context, message, ...args) => {
        if (level < Config.level) return;
        const label = LevelLabels[level];
        const levelStyle = Styles.level[level];
        
        console.log(
            `%c[${label}] %c[${moduleName}::%c${context}%c] %c- ${message}`,
            levelStyle,
            "color: #b0bec5;", // Bracket style
            "color: #eceff1; font-weight: bold;", // Context text style
            "color: #b0bec5;", // Bracket style
            "color: #cfd8dc;", // Message style
            ...args
        );
    };

    // Refactor log methods to handle optional context
    const logMethod = (level) => (contextOrMessage, ...args) => {
        if (typeof contextOrMessage === 'string' && args.length > 0) {
            // Called as logger.info('context', 'message', ...data)
            print(level, contextOrMessage, args[0], ...args.slice(1));
        } else {
            // Called as logger.info('message', ...data)
            print(level, 'general', contextOrMessage, ...args);
        }
    };

    return {
        debug: logMethod(LogLevel.DEBUG),
        info: logMethod(LogLevel.INFO),
        warn: logMethod(LogLevel.WARN),
        error: logMethod(LogLevel.ERROR),
        
        // [NEW] Timer Methods - Only active in DEBUG mode
        timer: (label) => {
            if (Config.level <= LogLevel.DEBUG) {
                console.time(`⏱️ [${moduleName}] ${label}`);
            }
        },
        timerEnd: (label) => {
            if (Config.level <= LogLevel.DEBUG) {
                console.timeEnd(`⏱️ [${moduleName}] ${label}`);
            }
        }
    };
}