# Path: src/multi_server.py
import logging
import threading
import time
import sys
from pathlib import Path
from typing import List, Dict, Any
from livereload import Server # type: ignore
from src.logging_config import setup_logging

# --- Configuration ---
PROJECT_ROOT = Path(__file__).parent.parent

SERVERS_CONFIG: List[Dict[str, Any]] = [
    {
        "name": "SOURCE (Web)",
        "port": 8000,
        "root": PROJECT_ROOT / "web",
        "watch": [
            "web/*.html",
            "web/assets/css/**/*.css",
            "web/assets/modules/**/*.js",
        ]
    },
    {
        "name": "BUILD ONLINE",
        "port": 8001,
        "root": PROJECT_ROOT / "build" / "dev-online",
        "watch": [
            "build/dev-online/index.html",
            "build/dev-online/assets/style.bundle.css",
            "build/dev-online/sw.js"
        ]
    },
    {
        "name": "BUILD OFFLINE",
        "port": 8002,
        "root": PROJECT_ROOT / "build" / "dev-offline",
        "watch": [
            "build/dev-offline/index.html",
            "build/dev-offline/assets/app.bundle.js",
            "build/dev-offline/assets/db_index.js"
        ]
    }
]

logger = setup_logging("MultiServer")

def start_server_instance(config: Dict[str, Any]) -> None:
    """Hàm worker để chạy một instance server trong luồng riêng."""
    try:
        root_path = config["root"]
        port = config["port"]
        name = config["name"]

        if not root_path.exists():
            logger.warning(f"⚠️ [{name}] Root dir not found: {root_path}. Skipping.")
            return

        server = Server()
        
        # Thiết lập theo dõi file
        for pattern in config["watch"]:
            # Pattern cần là đường dẫn tương đối hoặc tuyệt đối string
            # Ở đây ta dùng relative path từ Project Root để dễ quản lý
            watch_path = str(PROJECT_ROOT / pattern) if "*" not in pattern else pattern
            server.watch(watch_path)

        logger.info(f"🚀 [{name}] Serving at http://localhost:{port}")
        
        # Chặn output của từng server để tránh spam console quá nhiều
        server.serve(
            root=str(root_path),
            port=port,
            host="localhost",
            restart_delay=1,
            open_url_delay=None  # Không tự mở tab trình duyệt
        )
    except Exception as e:
        logger.error(f"❌ [{config['name']}] Error: {e}")

def run_orchestrator() -> None:
    """Chạy tất cả server song song."""
    threads = []
    
    logger.info("🔥 Starting Multi-Port Live Server...")
    logger.info("   (Press Ctrl+C to stop all servers)")

    # 1. Khởi tạo các luồng
    for config in SERVERS_CONFIG:
        t = threading.Thread(target=start_server_instance, args=(config,), daemon=True)
        threads.append(t)
        t.start()
        time.sleep(0.5) # Delay nhỏ để log in ra đẹp hơn

    # 2. Giữ main thread sống để hứng Ctrl+C
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("\n🛑 Stopping all servers...")
        sys.exit(0)

if __name__ == "__main__":
    run_orchestrator()