# Path: src/db/db_helpers.py
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.logging_config import setup_logging

logger = setup_logging("DB_Helpers")

def get_db_session(db_path):
    """
    Tạo kết nối SQLite an toàn.
    Đã sửa để dùng logger thay vì tools.printer.
    """
    if not os.path.exists(db_path):
        logger.error(f"❌ Database file doesn't exist: {db_path}")
        sys.exit(1)

    try:
        # Sử dụng 3 dấu gạch chéo cho đường dẫn tương đối/tuyệt đối unix
        engine = create_engine(f"sqlite:///{db_path}", echo=False)
        Session = sessionmaker(bind=engine)
        return Session()
    except Exception as e:
        logger.error(f"❌ Can't connect to database: {e}")
        sys.exit(1)