# Path: src/live_server.py
import logging
import sys
from livereload import Server # type: ignore
from src.logging_config import setup_logging

# Cấu hình đường dẫn
WEB_DIR = "web"
WATCH_PATTERNS = [
    "web/*.html",
    "web/assets/css/**/*.css",
    "web/assets/modules/**/*.js",
    "web/assets/db/**/*.json"
]

def run_live_server() -> None:
    """
    Chạy server development với tính năng Live Reload.
    Tự động refresh trình duyệt khi file nguồn thay đổi.
    """
    logger = setup_logging("LiveServer")
    
    try:
        server = Server()
        
        # Theo dõi các file để reload
        logger.info(f"👀 Watching for changes in '{WEB_DIR}/'...")
        for pattern in WATCH_PATTERNS:
            server.watch(pattern)
            
        # Khởi động server
        logger.info("🚀 Starting Live Server at http://localhost:8000")
        logger.info("   (Press Ctrl+C to stop)")
        
        server.serve(
            root=WEB_DIR, 
            port=8000, 
            host="localhost",
            restart_delay=0.5
        )
        
    except ImportError:
        logger.error("❌ Library 'livereload' not found.")
        logger.info("   👉 Please run: pip install livereload")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_live_server()