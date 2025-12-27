# Path: src/dict_builder/logic/db_converter.py
import shutil
import sqlite3
import logging
from pathlib import Path
from ..builder_config import BuilderConfig
# [FIXED] Import từ package 'database' thay vì module 'output_database' cũ
from .database import OutputDatabase

logger = logging.getLogger("dict_builder.converter")

class DbConverter:
    @staticmethod
    def create_tiny_from_mini(mini_config: BuilderConfig, tiny_config: BuilderConfig) -> bool:
        """
        Tạo database Tiny bằng cách copy Mini và xóa cột dư thừa.
        Re-generates views để phù hợp schema mới.
        """
        src_path = mini_config.output_path
        dest_path = tiny_config.output_path
        
        if not src_path.exists():
            logger.error(f"Source DB not found: {src_path}. Cannot create Tiny version.")
            return False

        logger.info(f"⚡ Creating Tiny DB from Mini DB...")
        logger.info(f"   Copying {src_path.name} -> {dest_path.name}...")
        
        # 1. Copy file
        try:
            if dest_path.exists():
                dest_path.unlink()
            shutil.copy2(src_path, dest_path)
        except Exception as e:
            logger.error(f"Failed to copy DB: {e}")
            return False

        # 2. Modify DB (Drop Columns & Old Views)
        conn = None
        try:
            conn = sqlite3.connect(dest_path)
            cursor = conn.cursor()
            
            suffix = "json"
            
            logger.info("   Dropping unused views and columns...")
            
            # [CRITICAL FIX] Drop Dependent View FIRST
            cursor.execute("DROP VIEW IF EXISTS view_search_results")
            cursor.execute("DROP VIEW IF EXISTS grand_lookups")
            
            # Drop heavy columns
            cursor.execute(f"ALTER TABLE entries DROP COLUMN grammar_{suffix}")
            cursor.execute(f"ALTER TABLE entries DROP COLUMN example_{suffix}")
            
            # Update Metadata
            logger.info("   Updating metadata...")
            cursor.execute("UPDATE metadata SET value = ? WHERE key = 'mode'", ("tiny",))
            
            conn.commit()
            conn.close()

            # 3. Re-generate Views using OutputDatabase logic
            logger.info("   Regenerating optimized views for Tiny Mode...")
            
            # Khởi tạo OutputDatabase nhưng trỏ vào file đã có
            tiny_db = OutputDatabase(tiny_config)
            
            # [NOTE] OutputDatabase mới cần setup connection thủ công nếu không gọi setup()
            # Vì ta đang attach vào DB có sẵn, ta cần init các managers
            tiny_db.conn = sqlite3.connect(tiny_config.output_path)
            tiny_db.cursor = tiny_db.conn.cursor()
            
            # Init thủ công các managers cần thiết (vì không gọi setup())
            from .database.view_manager import ViewManager
            from .database.schema_manager import SchemaManager
            
            schema = SchemaManager(tiny_db.cursor, tiny_config)
            views = ViewManager(tiny_db.cursor, tiny_config, schema)
            
            # Gọi hàm tạo view thông qua ViewManager
            views.create_all_views()
            
            # 4. Optimize
            logger.info("   Optimizing (VACUUM)...")
            tiny_db.conn.execute("VACUUM")
            tiny_db.conn.close()
            
            logger.info(f"✅ Tiny DB created successfully at {dest_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to convert DB: {e}", exc_info=True)
            return False
        finally:
            if conn:
                try:
                    conn.close()
                except:
                    pass