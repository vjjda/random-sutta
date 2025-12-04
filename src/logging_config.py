# Path: src/logging_config.py
import logging
import logging.config
import os
from pathlib import Path

# Xác định Project Root (src/ -> project_root)
PROJECT_ROOT = Path(__file__).parent.parent
LOGS_DIR = PROJECT_ROOT / "logs"
LOG_FILE = LOGS_DIR / "app.log"

def setup_logging(module_name: str = None) -> logging.Logger:
    """
    Cấu hình logging chuẩn cho toàn bộ dự án.
    - Console: Level INFO, format gọn.
    - File: Level INFO, format chi tiết (kèm tên file, dòng), xoay vòng file 10MB.
    """
    # 1. Đảm bảo thư mục logs tồn tại
    LOGS_DIR.mkdir(exist_ok=True)

    # 2. Cấu hình Dictionary
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%H:%M:%S"
            },
            "detailed": {
                # Thêm tên file và số dòng để debug dễ hơn trong file log
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "standard",
                "level": "INFO",
                "stream": "ext://sys.stdout"
            },
            "file": {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": str(LOG_FILE),
                "mode": "a",
                "maxBytes": 10 * 1024 * 1024, # 10 MB
                "backupCount": 5,             # Giữ lại 5 file cũ
                "formatter": "detailed",
                "level": "INFO",
                "encoding": "utf-8"           # Quan trọng để log Emoji không lỗi
            }
        },
        "root": {
            "handlers": ["console", "file"],
            "level": "INFO"
        }
    }

    # 3. Apply Config
    logging.config.dictConfig(logging_config)
    
    # 4. Trả về logger
    return logging.getLogger(module_name) if module_name else logging.getLogger()