# Path: src/live_server.py
import logging
import sys
import socket
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

def get_network_info():
    """Lấy thông tin IP LAN và Hostname."""
    try:
        # Lấy IP LAN bằng cách kết nối giả (không gửi gói tin thật)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip_address = s.getsockname()[0]
        s.close()
    except Exception:
        ip_address = "127.0.0.1"

    try:
        # Lấy Hostname của máy tính (macOS thường hỗ trợ .local)
        hostname = socket.gethostname()
        if not hostname.endswith(".local"):
            hostname = f"{hostname}.local"
    except Exception:
        hostname = "localhost"
        
    return ip_address, hostname

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
            
        # Lấy thông tin mạng
        ip, hostname = get_network_info()
        port = 8000
        
        url_local = f"http://localhost:{port}"
        url_ip = f"http://{ip}:{port}"
        url_host = f"http://{hostname}:{port}"

        # Khởi động server
        logger.info("🚀 Starting Live Server")
        logger.info(f"   👉 Local:           {url_local}")
        logger.info(f"   👉 Network (IP):    {url_ip}")
        logger.info(f"   👉 Network (Host):  {url_host}")
        
        # Tạo QR Code
        try:
            import qrcode # type: ignore
            qr = qrcode.QRCode()
            qr.add_data(url_host)
            qr.make(fit=True)
            print("\nScan this QR Code to access via Hostname (Stable):")
            qr.print_ascii()
            print("\n")
        except ImportError:
            logger.info("   💡 Tip: Run 'pip install qrcode' to see a QR code here.")

        logger.info("   (Press Ctrl+C to stop)")
        
        server.serve(
            root=WEB_DIR, 
            port=port, 
            host="0.0.0.0",
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