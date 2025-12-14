# Path: src/multi_server.py
import logging
import threading
import time
import sys
import socket
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
        "name": "BUILD PWA", # [RENAMED]
        "port": 8001,
        "root": PROJECT_ROOT / "build" / "pwa", # [UPDATED]
        "watch": [
            "build/pwa/index.html",
            "build/pwa/assets/style.bundle.css",
            "build/pwa/sw.js"
        ]
    },
    {
        "name": "BUILD SERVERLESS",
        "port": 8002,
        "root": PROJECT_ROOT / "build" / "serverless",
        "watch": [
            "build/serverless/index.html",
            "build/serverless/assets/app.bundle.js",
            "build/serverless/assets/db_index.js"
        ]
    }
]

logger = setup_logging("MultiServer")

def get_lan_ip() -> str:
    """Lấy địa chỉ IP mạng Lan để hiển thị cho tiện."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# [NEW] Hàm tắt log rác
def silence_tornado_logs() -> None:
    """Chặn log INFO (200 OK) của Tornado để console đỡ rác."""
    # Chỉ hiện WARNING hoặc ERROR
    logging.getLogger("tornado.access").setLevel(logging.WARNING)
    logging.getLogger("tornado.application").setLevel(logging.WARNING)
    logging.getLogger("tornado.general").setLevel(logging.WARNING)

def start_server_instance(config: Dict[str, Any]) -> None:
    """Hàm worker để chạy một instance server trong luồng riêng."""
    try:
        # [NEW] Apply silence settings cho từng thread
        silence_tornado_logs()

        root_path = config["root"]
        port = config["port"]
        name = config["name"]

        if not root_path.exists():
            logger.warning(f"⚠️ [{name}] Root dir not found: {root_path}. Skipping.")
            return

        server = Server()
        
        # Thiết lập theo dõi file
        for pattern in config["watch"]:
            watch_path = str(PROJECT_ROOT / pattern) if "*" not in pattern else pattern
            server.watch(watch_path)

        logger.info(f"🚀 [{name}] Serving at http://0.0.0.0:{port}")
        
        server.serve(
            root=str(root_path),
            port=port,
            host="0.0.0.0",
            restart_delay=1,
            open_url_delay=None 
        )
    except Exception as e:
        logger.error(f"❌ [{config['name']}] Error: {e}")

def run_orchestrator() -> None:
    """Chạy tất cả server song song."""
    threads = []
    
    # [NEW] Apply global silence (cho chắc chắn)
    silence_tornado_logs()

    lan_ip = get_lan_ip()
    logger.info("🔥 Starting Omni-Channel Server (LAN Access Enabled)...")
    logger.info(f"👉 Local:   http://localhost:[port]")
    logger.info(f"👉 Network: http://{lan_ip}:[port]")
    logger.info("   (Press Ctrl+C to stop all servers)")

    # 1. Khởi tạo các luồng
    for config in SERVERS_CONFIG:
        t = threading.Thread(target=start_server_instance, args=(config,), daemon=True)
        threads.append(t)
        t.start()
        time.sleep(0.5) 

    # 2. Giữ main thread sống để hứng Ctrl+C
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("\n🛑 Stopping all servers...")
        sys.exit(0)

if __name__ == "__main__":
    run_orchestrator()