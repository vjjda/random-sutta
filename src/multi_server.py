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

def get_network_info() -> tuple[str, str]:
    """Lấy thông tin IP LAN và Hostname."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"

    try:
        hostname = socket.gethostname()
        if not hostname.endswith(".local"):
            hostname = f"{hostname}.local"
    except Exception:
        hostname = "localhost"
        
    return ip, hostname

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

        # logger.info(f"🚀 [{name}] Serving at http://0.0.0.0:{port}") # Moved to Orchestrator summary
        
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

    ip, hostname = get_network_info()
    
    logger.info("🔥 Starting Omni-Channel Server System...")
    print("\n" + "="*60)
    print(f"{'SERVICE':<20} | {'PORT':<6} | {'URL (Stable Hostname)':<30}")
    print("-" * 60)
    
    for config in SERVERS_CONFIG:
        url = f"http://{hostname}:{config['port']}"
        print(f"{config['name']:<20} | {config['port']:<6} | {url}")
        
    print("="*60 + "\n")

    logger.info(f"👉 LAN IP Access: http://{ip}:[port]")

    # QR Code Generation (For Main Source Web - Port 8000)
    try:
        import qrcode # type: ignore
        main_url = f"http://{hostname}:8000"
        qr = qrcode.QRCode()
        qr.add_data(main_url)
        qr.make(fit=True)
        print(f"\n📱 Scan for SOURCE WEB ({main_url}):")
        qr.print_ascii()
        print("\n")
    except ImportError:
         logger.info("💡 Tip: Run 'pip install qrcode' to see QR codes.")

    logger.info("   (Press Ctrl+C to stop all servers)")

    # 1. Khởi tạo các luồng
    for config in SERVERS_CONFIG:
        t = threading.Thread(target=start_server_instance, args=(config,), daemon=True)
        threads.append(t)
        t.start()
        time.sleep(0.2) 

    # 2. Giữ main thread sống để hứng Ctrl+C
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("\n🛑 Stopping all servers...")
        sys.exit(0)

if __name__ == "__main__":
    run_orchestrator()